-- Create a function that sends a POST request to the dashboard webhook
-- Note: This requires the pg_net extension to be enabled in Supabase
-- If not available, the User must set up the webhook via the UI.
-- For standard implementations, we just rely on triggers to notify an external service or Supabase Edge Function.
-- However, since pointing directly to localhost/dashboard URL from Postgres isn't standard in prod (needs public URL),
-- we will assume the user has the 'booking_sessions' webhook setup in the UI and just needs to ADD 'leads' table to it.

-- BUT, we can at least prepare the database side if they are using database triggers calling edge functions.
-- Given the current setup likely uses Supabase Dashboard Webhooks (which listen to the transaction log), 
-- the most effective action is to INSTRUCT the user to add the webhook.

-- However, to be helpful, let's add a robust trigger function that *could* be used if they have an internal relay.
-- Actually, the user's existing system likely relies on the "Database Webhooks" feature in the Supabase UI.
-- There is no SQL migration that can "configure" the HTTP webhook destination reliably without pg_net.

-- Strategy: We will create a dummy trigger function to document the intent, but strictly speaking,
-- the user MUST add the webhook in the Supabase Dashboard:
-- "Table: leads" -> "Events: INSERT, UPDATE" -> "Webhook: https://.../api/webhooks/ghl-sync"

-- Let's check if we can add a comment or just skip the SQL if it's UI-managed.
-- I'll create a SQL file that adds a comment to the leads table to serve as documentation/reminder.

COMMENT ON TABLE public.leads IS 'Synced to GHL via Dashboard Webhook (Events: INSERT, UPDATE)';
