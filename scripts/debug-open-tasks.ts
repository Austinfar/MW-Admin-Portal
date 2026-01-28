
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const emailQuery = 'test.run.08@mailinator.com' // From screenshot "Test Run 8"
    console.log(`Searching for client with email: ${emailQuery}`)

    // Find client
    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, email, status')
        .ilike('email', `%${emailQuery}%`)

    if (error) {
        console.error('Error finding client:', error)
        return
    }

    if (!clients || clients.length === 0) {
        console.log('Client not found')
        return
    }

    const client = clients[0]
    console.log('Client found:', client)

    // Get ALL tasks
    const { data: tasks, error: taskError } = await supabase
        .from('onboarding_tasks')
        .select('id, title, status, client_id')
        .eq('client_id', client.id)

    if (taskError) {
        console.error('Error finding tasks:', taskError)
        return
    }

    console.log(`Total tasks found: ${tasks?.length}`)
    console.table(tasks)

    const openTasks = tasks?.filter(t => t.status === 'pending')
    console.log(`Open (pending) tasks: ${openTasks?.length}`)
}

main()
