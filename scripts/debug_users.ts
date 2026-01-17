
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function listUsers() {
    console.log('--- Auth Users ---');
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) console.error(authError);
    else users.forEach(u => console.log(`${u.email} (${u.id})`));

    console.log('\n--- Public Profiles (users table) ---');
    const { data: profiles, error: dbError } = await supabase
        .from('users')
        .select('id, email, name, role');

    if (dbError) console.error(dbError);
    else console.table(profiles);
}

listUsers();
