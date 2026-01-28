
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToGHL } from '@/lib/services/ghl'

async function repairLead() {
    const supabase = createAdminClient()
    const email = 'test.run.09@mailinator.com'

    // 1. Find Lead
    const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('email', email)
        .single()

    if (!lead) return console.log('Lead not found')

    console.log(`Reparing Lead: ${lead.first_name} ${lead.last_name} (Current GHL ID: ${lead.ghl_contact_id})`)

    // 2. Sync to GHL
    const ghlResult = await pushToGHL({
        email: lead.email,
        firstName: lead.first_name,
        lastName: lead.last_name || '',
        phone: lead.phone || '',
        tags: ['repaired_from_dashboard', 'lead_repair'],
        status: lead.status || 'New'
    })

    console.log('GHL Result:', ghlResult)

    if (ghlResult.ghlContactId) {
        const { error } = await supabase
            .from('leads')
            .update({ ghl_contact_id: ghlResult.ghlContactId })
            .eq('id', lead.id)

        if (error) console.error('DB Update Failed:', error)
        else console.log(`SUCCESS. Updated Lead with GHL ID: ${ghlResult.ghlContactId}`)
    } else {
        console.error('Failed to get GHL ID')
    }
}

repairLead()
