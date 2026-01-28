
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'

async function checkLead() {
    const supabase = createAdminClient()
    const query = 'test.lead09' // Searching by this pattern

    // 1. Find Lead
    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(5)

    if (error) return console.error(error)
    if (!leads || leads.length === 0) return console.log('Lead not found')

    console.log(`Found ${leads.length} leads matching "${query}":`)
    leads.forEach(lead => {
        console.log(`---`)
        console.log(`ID: ${lead.id}`)
        console.log(`Name: ${lead.first_name} ${lead.last_name}`)
        console.log(`Email: ${lead.email}`)
        console.log(`Status: ${lead.status}`)
        console.log(`GHL ID: ${lead.ghl_contact_id || 'NULL/MISSING'}`)
        console.log(`Date: ${lead.created_at}`)
    })
}

checkLead()
