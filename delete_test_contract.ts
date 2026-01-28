
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
    console.log('Finding client "Test Run 5"...')

    // 1. Find the client
    const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', '%Test Run 5%')

    if (clientError) {
        console.error('Error finding client:', clientError)
        return
    }

    if (!clients || clients.length === 0) {
        console.log('No client found matching "Test Run 5"')
        return
    }

    console.log(`Found ${clients.length} client(s):`, clients)

    for (const client of clients) {
        console.log(`Processing client: ${client.name} (${client.id})`)

        // 2. Delete Agreements first (foreign key constraint likely)
        const { error: agError } = await supabase
            .from('client_agreements')
            .delete()
            .eq('client_id', client.id)

        if (agError) {
            console.error(`Error deleting agreements for ${client.name}:`, agError)
        } else {
            console.log(`Deleted agreements for ${client.name}`)
        }

        // 3. Delete Contracts
        const { error: conError } = await supabase
            .from('client_contracts')
            .delete()
            .eq('client_id', client.id)

        if (conError) {
            console.error(`Error deleting contracts for ${client.name}:`, conError)
        } else {
            console.log(`Deleted contracts for ${client.name}`)
        }

        // 4. Reset client's current_contract_id reference
        const { error: updateError } = await supabase
            .from('clients')
            .update({ current_contract_id: null, contract_end_date: null })
            .eq('id', client.id)

        if (updateError) {
            console.error(`Error resetting client contract refs:`, updateError)
        } else {
            console.log(`Reset current_contract_id for ${client.name}`)
        }
    }
}

main()
