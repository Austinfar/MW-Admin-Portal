-- Sales Floor System Migration
-- Creates follow_up_tasks table and adds quota columns to users

-- ============================================
-- 1. Add quota columns to users table
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS revenue_quota_monthly numeric DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deals_quota_monthly integer DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bookings_quota_monthly integer DEFAULT NULL;

-- ============================================
-- 2. Create follow_up_tasks table
-- ============================================
CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Outcome from the Zoom call
  outcome_type text NOT NULL CHECK (outcome_type IN (
    'follow_up_zoom',
    'send_proposal',
    'needs_nurture',
    'lost',
    'no_show'
  )),

  callback_date timestamptz, -- When to follow up (null for 'lost')
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'converted')),

  -- Links to the source Zoom call that created this task
  source_call_log_id uuid REFERENCES sales_call_logs(id) ON DELETE SET NULL,

  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_assigned ON follow_up_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_callback ON follow_up_tasks(callback_date);
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_outcome ON follow_up_tasks(outcome_type);
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_lead ON follow_up_tasks(lead_id);

-- ============================================
-- 3. Create sales_floor_resources table
-- For storing quick links to Google Docs/Drive resources
-- ============================================
CREATE TABLE IF NOT EXISTS sales_floor_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'scripts', 'objections', 'pricing', 'training'
  title text NOT NULL,
  url text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 4. RLS Policies for follow_up_tasks
-- ============================================
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tasks assigned to them
CREATE POLICY "Users can view their own tasks"
  ON follow_up_tasks
  FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: Users can create tasks
CREATE POLICY "Users can create tasks"
  ON follow_up_tasks
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update their own tasks or admins can update any
CREATE POLICY "Users can update their assigned tasks"
  ON follow_up_tasks
  FOR UPDATE
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Policy: Only admins can delete tasks
CREATE POLICY "Admins can delete tasks"
  ON follow_up_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 5. RLS Policies for sales_floor_resources
-- ============================================
ALTER TABLE sales_floor_resources ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view active resources
CREATE POLICY "Users can view active resources"
  ON sales_floor_resources
  FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- Policy: Only admins can manage resources
CREATE POLICY "Admins can manage resources"
  ON sales_floor_resources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 6. Insert default resource categories
-- ============================================
INSERT INTO sales_floor_resources (category, title, url, description, sort_order) VALUES
  ('scripts', 'Main Sales Script', 'https://docs.google.com/document', 'Primary sales call script', 1),
  ('objections', 'Objection Handlers', 'https://docs.google.com/document', 'Common objections and responses', 1),
  ('pricing', 'Pricing Guide', 'https://docs.google.com/document', 'Current pricing and packages', 1),
  ('training', 'Training Videos', 'https://drive.google.com/drive', 'Sales training resources', 1)
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. Function to auto-create follow-up task after call
-- ============================================
CREATE OR REPLACE FUNCTION create_follow_up_task(
  p_lead_id uuid,
  p_assigned_to uuid,
  p_outcome_type text,
  p_callback_date timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source_call_log_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_task_id uuid;
BEGIN
  INSERT INTO follow_up_tasks (
    lead_id,
    assigned_to,
    outcome_type,
    callback_date,
    notes,
    source_call_log_id,
    created_by
  ) VALUES (
    p_lead_id,
    p_assigned_to,
    p_outcome_type,
    p_callback_date,
    p_notes,
    p_source_call_log_id,
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
