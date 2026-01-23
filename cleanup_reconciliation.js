const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Env
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...vals] = trimmed.split('=');
        if (k && vals.length > 0) {
            env[k.trim()] = vals.join('=').trim();
        }
    }
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function cleanup() {
    console.log('Deleting 18 Extra Payments (and linked Commissions) to reconcile with CSV...');

    const idsToDelete = [
        '7cc78ee7-a861-4455-a45e-013f784add42',
        '5d25f71c-5bd5-4825-af4c-88c8b909eb33',
        'cdfbdb4a-6415-4b6c-81a4-22818d64e19f',
        '22d17e1c-f254-46e4-81a5-f47d531d2339',
        '5281399f-22eb-4d1e-aeb8-08b029b98962',
        'bbfdc4d7-cd65-491b-97fd-af9375857b0e',
        '28a0cdbc-bf11-4c22-a6a3-7616e9f60282',
        'd0445887-5c84-4db9-a72d-29c53b9a2633',
        'f203e89f-d476-461b-878c-a3822a971e16',
        'c8bb3752-a476-46fc-94aa-28bb14e2ee2f',
        '2e1a5001-6f09-47bb-a512-622d0558a787',
        '0453e365-5d2c-4019-bf70-4800f018d24b',
        'bc3fec96-2bae-4411-b739-71f0aab000cd',
        '6efb324f-6e83-41b1-8ede-44b5c2bd8dea',
        'f6eacbcd-f70f-4b02-983a-6c6497add26f',
        '4d9a81bb-cc05-4549-a65f-254be6fb4346',
        '149b5613-0141-4723-8ce0-94bcb7bd3d3c',
        '79a21762-57fa-48e9-8061-0e599dbbd696'
    ];

    // 1. Delete linked commission_ledger entries first
    const { count: cComms, error: eComms } = await supabase
        .from('commission_ledger')
        .delete({ count: 'exact' })
        .in('payment_id', idsToDelete);

    if (eComms) console.error('Error deleting commissions:', eComms);
    else console.log(`Deleted ${cComms} linked commission ledger entries.`);

    // 2. Delete payments
    const { count: cPay, error: ePay } = await supabase
        .from('payments')
        .delete({ count: 'exact' })
        .in('id', idsToDelete);

    if (ePay) console.error('Error deleting payments:', ePay);
    else console.log(`Successfully deleted ${cPay} payments.`);
}

cleanup();
