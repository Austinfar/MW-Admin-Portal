
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '@/lib/supabase/admin';

async function main() {
    console.log('Starting Global Notes Backfill...');

    // Dynamic import to ensure env vars are loaded first
    const { syncGHLContact } = await import('@/lib/ghl/sync');

    const supabase = createAdminClient();

    // 1. Fetch all clients with a GHL Contact ID
    const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, email, ghl_contact_id')
        .not('ghl_contact_id', 'is', null);

    if (error) {
        console.error('Failed to fetch clients:', error);
        return;
    }

    console.log(`Found ${clients.length} clients to sync.`);

    let successCount = 0;
    let failCount = 0;

    // 2. Iterate and Sync
    for (const [index, client] of clients.entries()) {
        console.log(`[${index + 1}/${clients.length}] Syncing ${client.name} (${client.ghl_contact_id})...`);

        try {
            const result = await syncGHLContact(client.ghl_contact_id);
            if (result.success) {
                console.log(`  > Success.`);
                successCount++;
            } else {
                console.error(`  > Failed: ${result.error}`);
                failCount++;
            }
        } catch (err) {
            console.error(`  > Exception:`, err);
            failCount++;
        }

        // Small delay to be nice to GHL API rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('-----------------------------------');
    console.log(`Backfill Complete.`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed:  ${failCount}`);
}

main();
