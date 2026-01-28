
import { createAdminClient } from '@/lib/supabase/admin'

async function listBuckets() {
    const admin = createAdminClient()
    const { data, error } = await admin.storage.listBuckets()

    if (error) {
        console.error('Error listing buckets:', error)
        return
    }

    console.log('Buckets:', data.map(b => ({ id: b.id, name: b.name, public: b.public })))
}

listBuckets()
