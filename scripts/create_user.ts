
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createUser() {
    const email = 'matt@mwfitnesscoaching.com';
    const password = '100kmonthsin90days!';
    const role = 'coach';
    const name = 'Matt';

    console.log(`Creating user ${email}...`);

    // 1. Create Auth User
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role }
    });

    if (createError) {
        console.error('Error creating auth user:', createError.message);
        return;
    }

    if (!authUser.user) {
        console.error('No user returned');
        return;
    }

    console.log('Auth user created:', authUser.user.id);

    // 2. Create Public Profile
    const { error: profileError } = await supabase
        .from('users')
        .upsert({
            id: authUser.user.id,
            email: email,
            role: role,
            name: name,
            is_active: true
        });

    if (profileError) {
        console.error('Error creating profile:', profileError.message);
    } else {
        console.log('Profile created successfully in public.users');
    }
}

createUser();
