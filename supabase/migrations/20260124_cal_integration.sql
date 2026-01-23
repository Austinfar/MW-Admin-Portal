-- Cal.com Integration Migration
-- Adds setter job title, business settings, cal user links, and cal bookings tables

-- ============================================
-- 1. Business Settings Table
-- For storing global configuration like team calendar URL
-- ============================================
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default settings
INSERT INTO business_settings (key, value, description) VALUES
  ('global_team_calendar_url', '', 'Global team booking calendar URL for round-robin scheduling'),
  ('cal_webhook_enabled', 'true', 'Whether Cal.com webhooks are enabled')
ON CONFLICT (key) DO NOTHING;

-- RLS for business_settings
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings
CREATE POLICY "Users can view business settings"
  ON business_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can update settings
CREATE POLICY "Admins can update business settings"
  ON business_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Only super_admin can insert/delete settings
CREATE POLICY "Super admins can manage business settings"
  ON business_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- ============================================
-- 2. Cal User Links Table
-- Stores booking calendar URLs for each user
-- ============================================
CREATE TABLE IF NOT EXISTS cal_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_type text NOT NULL CHECK (link_type IN ('consult', 'monthly_coaching')),
  url text NOT NULL,
  display_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Each user can only have one link per type
  UNIQUE(user_id, link_type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cal_user_links_user ON cal_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_cal_user_links_type ON cal_user_links(link_type);
CREATE INDEX IF NOT EXISTS idx_cal_user_links_active ON cal_user_links(is_active) WHERE is_active = true;

-- RLS for cal_user_links
ALTER TABLE cal_user_links ENABLE ROW LEVEL SECURITY;

-- Users can view all active links (needed for setter dropdown)
CREATE POLICY "Users can view active cal links"
  ON cal_user_links
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can manage their own links
CREATE POLICY "Users can manage their own cal links"
  ON cal_user_links
  FOR ALL
  USING (user_id = auth.uid());

-- Admins can manage all links
CREATE POLICY "Admins can manage all cal links"
  ON cal_user_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 3. Cal Bookings Table
-- Stores booking data from Cal.com webhooks
-- ============================================
CREATE TABLE IF NOT EXISTS cal_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cal_booking_id integer UNIQUE NOT NULL,
  cal_uid text,                              -- Cal.com's UID for the booking

  -- Who the booking is with
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Matched lead (if found by email)
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,

  -- Booking details
  title text,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'ACCEPTED', 'CANCELLED', 'REJECTED', 'AWAITING_HOST',
    'IN_PROGRESS', 'COMPLETED', 'HOST_NO_SHOW', 'GUEST_NO_SHOW'
  )),

  -- Source tracking (company-driven vs coach-driven)
  source text CHECK (source IN ('company-driven', 'coach-driven', 'unknown')),
  event_type_slug text,                      -- e.g., 'coaching-consult', 'monthly-coaching'

  -- Attendee info
  attendee_email text,
  attendee_name text,
  attendee_timezone text,

  -- Meeting details
  meeting_url text,
  location text,

  -- Full webhook payload for reference
  metadata jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  rescheduled_at timestamptz
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cal_bookings_user ON cal_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_lead ON cal_bookings(lead_id);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_status ON cal_bookings(status);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_start ON cal_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_email ON cal_bookings(attendee_email);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_source ON cal_bookings(source);

-- RLS for cal_bookings
ALTER TABLE cal_bookings ENABLE ROW LEVEL SECURITY;

-- Users can view bookings assigned to them or that they created
CREATE POLICY "Users can view their bookings"
  ON cal_bookings
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Only system (via service role) or admins can insert/update bookings
CREATE POLICY "System can manage bookings"
  ON cal_bookings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 4. Function to match booking to lead by email
-- ============================================
CREATE OR REPLACE FUNCTION match_booking_to_lead(p_email text)
RETURNS uuid AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  SELECT id INTO v_lead_id
  FROM leads
  WHERE LOWER(email) = LOWER(p_email)
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Function to upsert cal booking from webhook
-- ============================================
CREATE OR REPLACE FUNCTION upsert_cal_booking(
  p_cal_booking_id integer,
  p_cal_uid text,
  p_title text,
  p_description text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_status text,
  p_source text,
  p_event_type_slug text,
  p_attendee_email text,
  p_attendee_name text,
  p_attendee_timezone text,
  p_meeting_url text,
  p_location text,
  p_user_email text,
  p_metadata jsonb
)
RETURNS uuid AS $$
DECLARE
  v_booking_id uuid;
  v_user_id uuid;
  v_lead_id uuid;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM users
  WHERE LOWER(email) = LOWER(p_user_email)
  LIMIT 1;

  -- Match lead by attendee email
  v_lead_id := match_booking_to_lead(p_attendee_email);

  -- Upsert booking
  INSERT INTO cal_bookings (
    cal_booking_id, cal_uid, user_id, lead_id,
    title, description, start_time, end_time, status,
    source, event_type_slug,
    attendee_email, attendee_name, attendee_timezone,
    meeting_url, location, metadata, updated_at
  ) VALUES (
    p_cal_booking_id, p_cal_uid, v_user_id, v_lead_id,
    p_title, p_description, p_start_time, p_end_time, p_status,
    p_source, p_event_type_slug,
    p_attendee_email, p_attendee_name, p_attendee_timezone,
    p_meeting_url, p_location, p_metadata, now()
  )
  ON CONFLICT (cal_booking_id) DO UPDATE SET
    cal_uid = EXCLUDED.cal_uid,
    user_id = COALESCE(EXCLUDED.user_id, cal_bookings.user_id),
    lead_id = COALESCE(EXCLUDED.lead_id, cal_bookings.lead_id),
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    status = EXCLUDED.status,
    meeting_url = COALESCE(EXCLUDED.meeting_url, cal_bookings.meeting_url),
    location = COALESCE(EXCLUDED.location, cal_bookings.location),
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    rescheduled_at = CASE
      WHEN cal_bookings.start_time != EXCLUDED.start_time THEN now()
      ELSE cal_bookings.rescheduled_at
    END,
    cancelled_at = CASE
      WHEN EXCLUDED.status = 'CANCELLED' AND cal_bookings.status != 'CANCELLED' THEN now()
      ELSE cal_bookings.cancelled_at
    END
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Update trigger for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to cal_user_links
DROP TRIGGER IF EXISTS update_cal_user_links_updated_at ON cal_user_links;
CREATE TRIGGER update_cal_user_links_updated_at
  BEFORE UPDATE ON cal_user_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to cal_bookings
DROP TRIGGER IF EXISTS update_cal_bookings_updated_at ON cal_bookings;
CREATE TRIGGER update_cal_bookings_updated_at
  BEFORE UPDATE ON cal_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
