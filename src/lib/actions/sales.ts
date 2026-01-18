'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function deleteSalesCallLog(id: string) {
    try {
        console.log(`[deleteSalesCallLog] Attempting to delete log with ID: ${id}`);
        const supabase = createAdminClient();

        const response = await supabase
            .from('sales_call_logs')
            .delete()
            .eq('id', id);

        console.log('[deleteSalesCallLog] Supabase Response:', response);

        const { error, count } = response;

        if (error) {
            console.error('[deleteSalesCallLog] Supabase DB Error:', error);
            return { error: `Database error: ${error.message} (${error.code})` };
        }

        // Check if row was actually deleted (if supported by return doc)
        // Note: DELETE usually returns status 204. count property might be available if explicit count option used?
        // Default delete doesn't return count unless selected.

        revalidatePath('/sales');
        return { success: true };
    } catch (error) {
        console.error('[deleteSalesCallLog] Unexpected error:', error);
        return { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
    }
}

import { createClient } from '@/lib/supabase/server';

export async function linkClientToLog(logId: string, clientId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('sales_call_logs')
        .update({ client_id: clientId })
        .eq('id', logId)
        .select()

    console.log('[linkClientToLog] Update result:', { data, error, logId, clientId })

    if (error) {
        console.error('Error linking client to log:', error)
        return { error: error.message }
    }

    if (!data || data.length === 0) {
        console.error('[linkClientToLog] No rows updated. Possible RLS issue or ID mismatch.')
        return { error: 'No changes made. Check permissions.' }
    }

    revalidatePath('/sales')
    revalidatePath(`/clients/${clientId}`)
    return { success: true }
}
