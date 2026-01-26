-- Allow public (anon) access to read active cal links
-- This is required for the booking funnel to fetch coach event type IDs without a user session.

CREATE POLICY "Public can view active cal links"
  ON cal_user_links
  FOR SELECT
  TO anon
  USING (is_active = true);
