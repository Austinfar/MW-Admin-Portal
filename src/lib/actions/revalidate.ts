'use server'

import { revalidatePath } from 'next/cache'

export async function refreshLeadsData() {
    revalidatePath('/leads')
    return { success: true, timestamp: new Date().toISOString() }
}
