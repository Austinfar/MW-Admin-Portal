
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'

async function checkLeadPhone() {
    const supabase = createAdminClient()
    const email = 'test.run.09@mailinator.com'

    // 1. Find Lead
    const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('email', email)
        .single()

    if (!lead) return console.log('Lead not found')

    console.log(`Lead: ${lead.first_name} ${lead.last_name}`)
    console.log(`Phone: ${lead.phone}`)
    console.log(`Email: ${lead.email}`)
}

checkLeadPhone()
