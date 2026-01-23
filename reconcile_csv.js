const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

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

async function reconcile() {
    console.log('Reconciling CSV vs Database...');

    // 1. Parse CSV
    const csvContent = fs.readFileSync('unified_payments (1).csv', 'utf8');
    const { data: csvRows } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

    // Filter CSV for Successful payments only (Status = Paid)
    // Note: CSV header includes 'Status' (Paid, Failed, Refunded)
    const validCsvPayments = csvRows.filter(r => r.Status === 'Paid' || r.Status === 'Succeeded');

    // Create Map of CSV Payments (by Stripe ID if available, usually 'id' column)
    const csvMap = new Map();
    let csvTotal = 0;

    validCsvPayments.forEach(r => {
        // id column is usually the charge id (ch_...) or py_...
        const id = r.id;
        const amount = parseFloat(r.Amount || r['Converted Amount']);
        csvMap.set(id, { id, amount, email: r['Customer Email'], date: r['Created date (UTC)'] });
        csvTotal += amount;
    });

    console.log(`CSV Total: ${validCsvPayments.length} payments, $${csvTotal.toLocaleString()}`);

    // 2. Fetch Database Payments for Jan 2026
    const start = '2026-01-01T00:00:00.000Z';
    const end = '2026-02-01T00:00:00.000Z';

    const { data: dbPayments } = await supabase
        .from('payments')
        .select('*')
        .gte('payment_date', start)
        .lt('payment_date', end)
        .eq('status', 'succeeded');

    const dbMap = new Map();
    let dbTotal = 0;
    dbPayments?.forEach(p => {
        // Our DB stores 'stripe_payment_id'. This might match CSV 'id' (ch_...) or 'PaymentIntent' (pi_...)
        // The CSV has 'id' (ch_...) and 'Card ID' (pm_...) but maybe not pi_?
        // Wait, line 2 of CSV: id=ch_..., but user might have synced pi_...
        // Let's print a sample to check matching strategy.
        dbMap.set(p.stripe_payment_id, p);
        dbTotal += p.amount;
    });

    console.log(`DB Total: ${dbPayments?.length} payments, $${dbTotal.toLocaleString()}`);

    // 3. Compare
    // Since ID formats might mismatch (ch_ vs pi_), we might need alternate matching (Amount + Date + partial Email?)
    // Let's try basic ID match first.

    const missingInDb = [];
    const extraInDb = [];

    // Check what's in CSV but missing in DB
    // PROBLEM: CSV has 'ch_...' but DB likely has 'pi_...' from the earlier sync.
    // We can't easily match ch_ to pi_ without a lookup or fuzzy match.
    // Strategy: Match by Amount + Approx Date (within 24h) + Email similarity?

    // Actually, look at the CSV again in previous step.
    // Line 7: id=ch_..., but also col 'orderId (metadata)'? No.
    // Wait, the CSV has 'id' as ch_...
    // Let's check our DB sample.
    // If DB uses pi_..., we are in trouble for direct ID match.
    // Let's try to match by Amount + Date (Day) + Customer Email.

    console.log('\n--- Discrepancy Analysis ---');

    // We'll use a "matched" set for DB items to find extras later.
    const matchedDbIds = new Set();

    validCsvPayments.forEach(csvP => {
        const amount = parseFloat(csvP.Amount);
        const email = csvP['Customer Email'];
        const dateStr = csvP['Created date (UTC)']; // 2026-01-22 19:05:31
        const date = new Date(dateStr);

        // Find candidate in DB
        const candidate = dbPayments.find(dbP => {
            if (matchedDbIds.has(dbP.id)) return false;

            // Amount match (exact)
            if (Math.abs(dbP.amount - amount) > 0.01) return false;

            // Date match (same day UTC is safe)
            const dbDate = new Date(dbP.payment_date);
            const diffHours = Math.abs(dbDate - date) / 36e5;
            if (diffHours > 24) return false; // Allow 24h skew

            return true;
        });

        if (candidate) {
            matchedDbIds.add(candidate.id);
        } else {
            missingInDb.push(csvP);
        }
    });

    // Find extras in DB (not matched by any CSV row)
    dbPayments.forEach(dbP => {
        if (!matchedDbIds.has(dbP.id)) {
            extraInDb.push(dbP);
        }
    });

    console.log(`Missing in DB (found in CSV): ${missingInDb.length}`);
    missingInDb.slice(0, 5).forEach(r => console.log(`- Missing: $${r.Amount} (${r['Customer Email']}) on ${r['Created date (UTC)']}`));

    console.log(`Extra in DB (not in CSV): ${extraInDb.length}`);
    extraInDb.slice(0, 5).forEach(r => console.log(`- Extra: $${r.amount} - ${r.payment_date}`));

    // Generate MD Report
    let md = `# Reconciliation Report\n\n`;
    md += `**CSV Total**: $${csvTotal.toLocaleString()} (${validCsvPayments.length})\n`;
    md += `**DB Total**: $${dbTotal.toLocaleString()} (${dbPayments.length})\n\n`;

    if (extraInDb.length > 0) {
        md += `## Extra Payments in DB (Delete Candidates)\n`;
        md += `These exist in your database but NOT in the master CSV.\n\n`;
        md += `| Amount | Date | ID |\n|---|---|---|\n`;
        extraInDb.forEach(p => md += `| $${p.amount} | ${p.payment_date} | ${p.id} |\n`);
    }

    if (missingInDb.length > 0) {
        md += `## Missing from DB (But in CSV)\n`;
        md += `These are valid payments from the CSV that we missed.\n\n`;
        md += `| Amount | Date | Email |\n|---|---|---|\n`;
        missingInDb.forEach(p => md += `| $${p.Amount} | ${p['Created date (UTC)']} | ${p['Customer Email']} |\n`);
    }

    fs.writeFileSync('reconciliation_report.md', md);
    console.log('Saved reconciliation_report.md');
}

reconcile();
