
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAdmin() {
    const userId = 'eb2673e0-e115-4a5d-a32d-2b107b17d986';
    const email = 'austin.farwell97@gmail.com';

    console.log(`Creating Admin profile for ${email}...`);

    const { error } = await supabase
        .from('users')
        .upsert({
            id: userId,
            email: email,
            role: 'admin',
            name: 'Austin Farwell',
            is_active: true
        });

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Success! Admin profile created.');
    }
}

fixAdmin();
