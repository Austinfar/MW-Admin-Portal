
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const usersToCreate = [
    {
        email: 'Austin@mwfitnesscoaching.com',
        password: 'Buddies97',
        role: 'super_admin',
        name: 'Austin Farwell',
    },
    {
        email: 'coach@test.com',
        password: 'password123',
        role: 'coach',
        name: 'Test Coach',
    },
    {
        email: 'sales@test.com',
        password: 'password123',
        role: 'sales_rep',
        name: 'Test Sales Rep',
    },
    {
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin',
        name: 'Test Admin',
    },
    {
        email: 'client@test.com',
        password: 'password123',
        role: 'client',
        name: 'Test Client',
    },
];

async function seedUsers() {
    console.log('Starting user seeding...');

    for (const user of usersToCreate) {
        try {
            console.log(`Creating user: ${user.email}...`);

            // 1. Create in Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true,
                user_metadata: { name: user.name },
            });

            if (authError) {
                console.error(`Error creating auth user ${user.email}:`, authError.message);
                // If user already exists, try to get their ID to update role
                if (authError.message.includes('already registered')) {
                    const { data: existingUser } = await supabase.from('users').select('id').eq('email', user.email).single();
                    if (existingUser) {
                        console.log(`User already exists, updating role...`);
                        await updateUserRole(existingUser.id, user.role);
                    }
                }
                continue;
            }

            if (authData.user) {
                console.log(`Auth user created: ${authData.user.id}`);
                // 2. Update Role in public.users
                // Wait a bit for trigger? Or update directly.
                // The trigger should create the public user. We'll update it.
                // We'll retry a few times to account for trigger delay.

                let retries = 3;
                while (retries > 0) {
                    await new Promise(r => setTimeout(r, 1000));
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({ role: user.role, name: user.name })
                        .eq('id', authData.user.id);

                    if (!updateError) {
                        console.log(`Updated public profile for ${user.email} -> Role: ${user.role}`);
                        break;
                    } else {
                        console.warn(`Retry ${4 - retries}: Failed to update public profile for ${user.email}`, updateError.message);
                        retries--;
                    }
                }
            }

        } catch (err) {
            console.error(`Unexpected error for ${user.email}:`, err);
        }
    }

    console.log('User seeding complete.');
}

async function updateUserRole(userId: string, role: string) {
    const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId);

    if (error) {
        console.error(`Error updating role for ${userId}:`, error.message);
    } else {
        console.log(`Updated role for ${userId} to ${role}`);
    }
}

seedUsers();
