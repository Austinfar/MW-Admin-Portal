// Check if follow_up_tasks table exists
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable() {
  console.log('Checking follow_up_tasks table...\n');

  const { data, error } = await supabase
    .from('follow_up_tasks')
    .select('id')
    .limit(1);

  if (error) {
    console.log('Error:', error.code, error.message);
    console.log('Full error:', JSON.stringify(error, null, 2));

    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.log('\n❌ Table "follow_up_tasks" does not exist.');
      console.log('\nTo create it, run the migration:');
      console.log('  supabase/migrations/20260121_sales_floor_system.sql');
    }
  } else {
    console.log('✓ Table exists! Found', data?.length || 0, 'rows (limited to 1)');
  }
}

checkTable().catch(console.error);
