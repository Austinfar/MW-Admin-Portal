
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

async function resetPassword() {
    const email = 'matt@mwfitnesscoaching.com'
    const newPassword = '100kmonthsin90days!'

    console.log(`Searching for user with email: ${email}...`)

    // 1. Find the user ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
        console.error('Error listing users:', listError)
        return
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
        console.error(`User with email ${email} not found. Available users:`, users.map(u => u.email))
        return
    }

    console.log(`Found user: ${user.id}`)

    // 2. Update the password
    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
    )

    if (error) {
        console.error('Error updating password:', error)
    } else {
        console.log(`Successfully updated password for ${email}`)
    }
}

resetPassword()
