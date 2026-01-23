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

async function auditMRR() {
    console.log('Fetching active subscriptions...');

    // Fetch all active/trialing subscriptions
    const { data: subs, error } = await supabase
        .from('subscriptions')
        .select(`
            id, 
            stripe_subscription_id, 
            status, 
            amount, 
            interval, 
            interval_count,
            currency,
            created_at,
            stripe_customer_id
        `)
        .in('status', ['active', 'trialing'])
        .order('amount', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Explicitly fetch client emails manually to avoid join issues if relations aren't perfect
    const customerIds = [...new Set(subs.map(s => s.stripe_customer_id).filter(Boolean))];
    const { data: clients } = await supabase
        .from('clients')
        .select('stripe_customer_id, email, name')
        .in('stripe_customer_id', customerIds);

    const clientMap = new Map(); // customer_id -> {email, name}
    clients?.forEach(c => clientMap.set(c.stripe_customer_id, c));

    let strictMonthlyMRR = 0;

    // Auxiliary stats
    let excludedMultiMonthTotal = 0;
    let excludedTrialingTotal = 0;

    const reportlines = [];
    reportlines.push(['Subscription ID', 'Customer', 'Email', 'Amount', 'Interval', 'Strict Monthly MRR', 'Reason Excluded']);

    subs.forEach(s => {
        let excludedReason = '';
        let contribution = 0;

        // Is it active?
        if (s.status !== 'active') {
            excludedReason = 'Status Not Active (Trialing)';
            excludedTrialingTotal += s.amount; // Approximate value
        }
        // Is it Strict Monthly (interval=month, count=1)?
        else if (s.interval !== 'month' || (s.interval_count && s.interval_count > 1)) {
            excludedReason = `Non-Monthly Interval (${s.interval_count > 1 ? s.interval_count + ' months' : s.interval})`;

            // Calculate what it WOULD have been in the old logic for comparison
            let amortized = s.amount;
            if (s.interval === 'year') amortized /= 12;
            else if (s.interval_count > 1) amortized /= s.interval_count;
            excludedMultiMonthTotal += amortized;
        }
        else {
            // It is active AND exact 1 month interval
            strictMonthlyMRR += s.amount;
            contribution = s.amount;
        }

        const client = clientMap.get(s.stripe_customer_id) || {};
        const name = client.name || s.stripe_customer_id;
        const email = client.email || 'N/A';

        // Log if it contributed or if it was a high-value active sub that was excluded
        reportlines.push([
            s.stripe_subscription_id,
            name,
            email,
            `$${s.amount}`,
            s.interval_count > 1 ? `${s.interval_count} months` : s.interval,
            contribution > 0 ? `$${contribution.toFixed(2)}` : '-',
            excludedReason
        ]);
    });

    console.log(`\nCalculation Result (STRICT MONTHLY DEFINITION):`);
    console.log(`Total Active+Trialing Subs Checked: ${subs.length}`);
    console.log(`\nStrict Monthly MRR: $${strictMonthlyMRR.toLocaleString()}`);
    console.log(`(Excluded Annual/Multi-Month Amortized Value: $${excludedMultiMonthTotal.toLocaleString()})`);
    console.log(`(Excluded Trialing Value: $${excludedTrialingTotal.toLocaleString()})`);

    // Generate Markdown Table
    const markdown = `
# Strict Monthly MRR Report

**Strict Monthly MRR**: **$${strictMonthlyMRR.toLocaleString("en-US", { currency: "USD", style: "currency" })}**
*(Excludes yearly and multi-month contracts)*

## Breakdown
- **Excluded Multi-Month Value**: ~$${excludedMultiMonthTotal.toLocaleString()}
- **Excluded Trialing Value**: ~$${excludedTrialingTotal.toLocaleString()}

## Detailed List
| Customer | Email | Amount | Interval | Monthly MRR | Excluded Reason | ID |
|----------|-------|--------|----------|-------------|-----------------|----|
${reportlines.slice(1, 150).map(row => `| ${row[1]} | ${row[2]} | ${row[3]} | ${row[4]} | ${row[5]} | ${row[6]} | ${row[0]} |`).join('\n')}
    `;

    fs.writeFileSync('mrr_report_summary.md', markdown);
    console.log('Report saved to mrr_report_summary.md');
}

auditMRR();
