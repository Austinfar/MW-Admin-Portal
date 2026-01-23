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

async function auditJanuary() {
    console.log('Fetching January 2026 Payments...');

    const start = '2026-01-01T00:00:00.000Z';
    const end = '2026-02-01T00:00:00.000Z';

    const { data: payments, error } = await supabase
        .from('payments')
        .select('*, clients(name, email)')
        .gte('payment_date', start)
        .lt('payment_date', end)
        .order('amount', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const successfulPayments = payments.filter(p => p.status === 'succeeded');
    const totalRev = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

    console.log(`\nJANUARY 2026 AUDIT`);
    console.log(`Total Payments: ${successfulPayments.length}`);
    console.log(`Total Revenue: $${totalRev.toLocaleString()}`);

    // Generate Report
    let md = `# January 2026 Revenue Audit\n\n`;
    md += `**Total Revenue**: $${totalRev.toLocaleString()}\n`;
    md += `**Count**: ${successfulPayments.length}\n\n`;

    md += `## Top Transactions\n`;
    md += `| Date | Amount | Client | Email | ID | Stripe ID | Created At (System) |\n`;
    md += `|---|---|---|---|---|---|---|\n`;

    successfulPayments.forEach(p => {
        md += `| ${new Date(p.payment_date).toLocaleDateString()} | **$${p.amount}** | ${p.clients?.name || 'Unknown'} | ${p.clients?.email || 'N/A'} | ${p.id} | ${p.stripe_payment_id} | ${new Date(p.created_at).toLocaleString()} |\n`;
    });

    fs.writeFileSync('jan_2026_audit.md', md);
    console.log('Saved to jan_2026_audit.md');
}

auditJanuary();
