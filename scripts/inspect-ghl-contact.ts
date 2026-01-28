
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { getAppSettings } from '@/lib/actions/app-settings'

async function inspectGHL() {
    // Manually fetch settings since we can't use server actions easily in script without mocking
    // Assuming Env vars are enough or hardcoding for debug if needed, but lets try env first
    // Actually, ghl.ts uses getAppSettings.
    // I'll just use fetch directly with Env vars if available, or try to read from DB.

    // Simpler: Use the ghl service but I can't export a "getContact" function easily if it doesn't exist.
    // I'll make a raw fetch here using the ENV vars which should be in .env.local

    const token = process.env.GHL_ACCESS_TOKEN
    const contactId = 'y2SZ4P0MAZbNQPE3RZ7c'

    if (!token) return console.log('No GHL_ACCESS_TOKEN in env')

    console.log(`Fetching GHL Contact: ${contactId}`)

    const res = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Version': '2021-07-28'
        }
    })

    const data = await res.json()
    console.log(JSON.stringify(data, null, 2))
}

inspectGHL()
