
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'

async function hardCleanup() {
    const supabase = createAdminClient()
    const email = 'test.run.05@mailinator.com'

    // 1. Find Client
    const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('email', email)
        .single()

    if (!client) return console.log('Client not found')

    console.log(`Hard Cleaning Client: ${client.name}`)

    // 2. Delete ALL agreements
    const { error } = await supabase
        .from('client_agreements')
        .delete()
        .eq('client_id', client.id)

    if (error) console.error('Error deleting agreements:', error)
    else console.log('All agreements deleted.')
}

hardCleanup()
