
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'

async function checkClient() {
    const supabase = createAdminClient()
    const email = 'test.run.08@mailinator.com'

    // 1. Find Client
    const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('email', email)
        .single()

    if (!client) {
        console.log('Client not found')
        return
    }

    console.log('Client Found:')
    console.log(`ID: ${client.id}`)
    console.log(`Email: ${client.email}`)
    console.log(`Phone: ${client.phone}`)
    console.log(`GHL ID: ${client.ghl_contact_id}`)
}

checkClient()
