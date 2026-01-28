
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createAdminClient } from '@/lib/supabase/admin'

async function verify() {
    const supabase = createAdminClient()
    const email = 'test.run.05@mailinator.com'

    // 1. Find Client
    const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('email', email)
        .single()

    if (!client) {
        console.log('Client not found')
        return
    }

    console.log(`Checking Client: ${client.name} (${client.id})`)

    // 2. Check Documents
    const { data: docs } = await supabase
        .from('client_documents')
        .select('*')
        .eq('client_id', client.id)

    console.log(`Documents Found: ${docs?.length}`)
    if (docs?.length) console.log(docs)

    // 3. Check Agreements
    const { data: agreements } = await supabase
        .from('client_agreements')
        .select('*')
        .eq('client_id', client.id)

    console.log(`Agreements Found: ${agreements?.length}`)
    agreements?.forEach(a => {
        console.log(`- ID: ${a.id} | Status: ${a.status} | GHL Doc ID: ${a.ghl_document_id} | Signed URL: ${a.signed_document_url}`)
    })
}

verify()
