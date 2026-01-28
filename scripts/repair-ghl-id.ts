
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToGHL } from '@/lib/services/ghl'

async function repair() {
    const supabase = createAdminClient()
    const email = 'test.run.08@mailinator.com'

    // 1. Find Client
    const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('email', email)
        .single()

    if (!client) return console.log('Client not found')

    console.log(`Reparing Client: ${client.name} (Current GHL ID: ${client.ghl_contact_id})`)

    // 2. Sync to GHL
    const ghlResult = await pushToGHL({
        email: client.email,
        firstName: client.name.split(' ')[0],
        lastName: client.name.split(' ').slice(1).join(' ') || '',
        phone: client.phone || '',
        tags: ['repaired_from_dashboard'],
        status: 'New'
    })

    console.log('GHL Result:', ghlResult)

    if (ghlResult.ghlContactId) {
        const { error } = await supabase
            .from('clients')
            .update({ ghl_contact_id: ghlResult.ghlContactId })
            .eq('id', client.id)

        if (error) console.error('DB Update Failed:', error)
        else console.log(`SUCCESS. Updated Client with GHL ID: ${ghlResult.ghlContactId}`)
    } else {
        console.error('Failed to get GHL ID')
    }
}

repair()
