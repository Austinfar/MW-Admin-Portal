
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'

async function listRecentLeads() {
    const supabase = createAdminClient()

    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

    if (error) return console.error(error)

    console.log(`Recent Leads:`)
    leads.forEach(lead => {
        console.log(`---`)
        console.log(`ID: ${lead.id}`)
        console.log(`Name: ${lead.first_name} ${lead.last_name}`)
        console.log(`Email: ${lead.email}`)
        console.log(`GHL ID: ${lead.ghl_contact_id || 'NULL'}`)
        console.log(`Created: ${lead.created_at}`)
    })
}

listRecentLeads()
