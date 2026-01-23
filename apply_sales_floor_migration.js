// Apply sales floor migration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('Applying sales floor migration...\n');

  // The migration SQL
  const sql = `
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
      outcome_type text NOT NULL CHECK (outcome_type IN (
        'follow_up_zoom',
        'send_proposal',
        'needs_nurture',
        'lost',
        'no_show'
      )),
      callback_date timestamptz,
      notes text,
      status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'converted')),
      source_call_log_id uuid REFERENCES sales_call_logs(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      completed_at timestamptz,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_assigned ON follow_up_tasks(assigned_to, status);
    CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_callback ON follow_up_tasks(callback_date);
    CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_outcome ON follow_up_tasks(outcome_type);
    CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_lead ON follow_up_tasks(lead_id);

    -- ============================================
    -- 3. Create sales_floor_resources table
    -- ============================================
    CREATE TABLE IF NOT EXISTS sales_floor_resources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category text NOT NULL,
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

    DROP POLICY IF EXISTS "Users can view their own tasks" ON follow_up_tasks;
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

    DROP POLICY IF EXISTS "Users can create tasks" ON follow_up_tasks;
    CREATE POLICY "Users can create tasks"
      ON follow_up_tasks
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS "Users can update their assigned tasks" ON follow_up_tasks;
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

    DROP POLICY IF EXISTS "Admins can delete tasks" ON follow_up_tasks;
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

    DROP POLICY IF EXISTS "Users can view active resources" ON sales_floor_resources;
    CREATE POLICY "Users can view active resources"
      ON sales_floor_resources
      FOR SELECT
      USING (is_active = true AND auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS "Admins can manage resources" ON sales_floor_resources;
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
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // exec_sql RPC might not exist, try direct query
    console.log('RPC not available, this migration needs to be run via Supabase Dashboard.');
    console.log('\nCopy the SQL from: supabase/migrations/20260121_sales_floor_system.sql');
    console.log('And run it in: Supabase Dashboard > SQL Editor');
    return;
  }

  console.log('✓ Migration applied successfully!');

  // Verify
  const { data, error: verifyError } = await supabase
    .from('follow_up_tasks')
    .select('id')
    .limit(1);

  if (verifyError) {
    console.log('\n⚠ Verification failed:', verifyError.message);
  } else {
    console.log('✓ Table verified - follow_up_tasks exists');
  }
}

applyMigration().catch(console.error);
