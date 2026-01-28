
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { pushToGHL } from '@/lib/services/ghl'

async function testSync() {
    console.log('Testing GHL Sync...')

    const testContact = {
        email: `test.sync.${Date.now()}@mailinator.com`,
        firstName: 'Test',
        lastName: 'Sync',
        phone: '+15550000000',
        tags: ['test_sync_script'],
        status: 'New'
    }

    console.log('Payload:', testContact)

    const result = await pushToGHL(testContact)

    console.log('Result:', result)

    if (result.error) {
        console.error('FAILED:', result.error)
        if (result.details) {
            console.error('Details:', JSON.stringify(result.details, null, 2))
        }
    } else {
        console.log('SUCCESS. GHL ID:', result.ghlContactId)
    }
}

testSync()
