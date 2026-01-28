
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'

async function cleanup() {
    const supabase = createAdminClient()
    const email = 'test.run.05@mailinator.com'

    console.log(`Searching for client: ${email}`)

    // 1. Find Client
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('email', email)
        .single()

    if (clientError || !client) {
        console.error('Client not found:', clientError)
        return
    }

    console.log(`Found Client: ${client.name} (${client.id})`)

    // 2. Delete Client Documents
    const { container: docsDelete, error: docsError } = await supabase
        .from('client_documents')
        .delete()
        .eq('client_id', client.id)

    // Note: delete() doesn't return count by default usually unless select is appended, 
    // but the main goal is just to execute it.
    if (docsError) console.error('Error deleting docs:', docsError)
    else console.log('Deleted client_documents records.')

    // 3. Reset Agreements
    const { error: agreeError } = await supabase
        .from('client_agreements')
        .update({
            status: 'sent',
            ghl_document_id: null,
            signed_document_url: null,
            signed_at: null,
            viewed_at: null,
            voided_at: null
        })
        .eq('client_id', client.id)

    if (agreeError) console.error('Error resetting agreements:', agreeError)
    else console.log('Reset client_agreements to "sent" status.')

    console.log('Cleanup complete.')
}

cleanup()
