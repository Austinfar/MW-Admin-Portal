
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function checkMattPermissions() {
    const email = 'matt@mwfitnesscoaching.com'

    console.log(`Checking permissions for: ${email}...`)

    // 1. Find the user ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
        console.error('Error listing users:', listError)
        return
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
        console.error(`User with email ${email} not found.`)
        return
    }

    console.log(`Found user ID: ${user.id}`)

    // 2. Fetch the profile row
    const { data, error } = await supabase
        .from('users')
        .select('role, permissions')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('Error fetching user profile:', error)
    } else {
        console.log('User Profile Data:')
        console.log(JSON.stringify(data, null, 2))
    }
}

checkMattPermissions()
