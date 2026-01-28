'use server'

import { revalidatePath } from 'next/cache'

export async function refreshLeadsData() {
    revalidatePath('/leads')
    return { success: true, timestamp: new Date().toISOString() }
}

export async function refreshClientsData() {
    revalidatePath('/clients')
    return { success: true, timestamp: new Date().toISOString() }
}
