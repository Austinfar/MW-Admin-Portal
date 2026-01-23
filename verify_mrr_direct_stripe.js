const Stripe = require('stripe');
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

const stripe = new Stripe(env['STRIPE_SECRET_KEY']);

async function verifyDirectStripe() {
    console.log('Fetching ALL active subscriptions directly from Stripe API...');

    let hasMore = true;
    let startingAfter = undefined;
    const allSubs = [];

    while (hasMore) {
        // Only fetch 'active' (and maybe 'past_due' if that counts? usually yes, but let's stick to active first)
        // User said "actually active".
        const subs = await stripe.subscriptions.list({
            limit: 100,
            status: 'active',
            expand: ['data.customer'],
            starting_after: startingAfter
        });

        allSubs.push(...subs.data);

        if (subs.has_more) {
            startingAfter = subs.data[subs.data.length - 1].id;
        } else {
            hasMore = false;
        }
    }

    console.log(`Fetched ${allSubs.length} active subscriptions.`);

    let totalMRR = 0;
    const reportLines = [];

    allSubs.sort((a, b) => (b.items.data[0].price.unit_amount - a.items.data[0].price.unit_amount));

    for (const sub of allSubs) {
        const price = sub.items.data[0].price; // Assume main item
        let amount = price.unit_amount / 100; // Convert to Dollars
        const interval = price.recurring.interval;

        let monthlyVal = amount;
        if (interval === 'year') monthlyVal = amount / 12;
        if (interval === 'week') monthlyVal = amount * 4; // Rough approx

        totalMRR += monthlyVal;

        const customerName = (typeof sub.customer === 'object') ? (sub.customer.name || sub.customer.email) : sub.customer;
        const email = (typeof sub.customer === 'object') ? sub.customer.email : 'N/A';

        reportLines.push({
            id: sub.id,
            customer: customerName,
            email: email,
            amount: amount,
            interval: interval,
            monthlyVal: monthlyVal,
            status: sub.status
        });
    }

    console.log(`\nDIRECT STRIPE MRR CALCULATION: $${totalMRR.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);

    // Generate CSV-like MD table
    let md = `# Direct Stripe Active Subscription Report\n\n`;
    md += `**Total Active Subs (Stripe API)**: ${allSubs.length}\n`;
    md += `**Total MRR**: $${totalMRR.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n\n`;

    md += `| Customer | Email | Amount (Billed) | Interval | Monthly Value | Status | Sub ID |\n`;
    md += `|---|---|---|---|---|---|---|\n`;

    reportLines.forEach(row => {
        md += `| ${row.customer} | ${row.email} | $${row.amount} | ${row.interval} | **$${row.monthlyVal.toFixed(2)}** | ${row.status} | ${row.id} |\n`;
    });

    fs.writeFileSync('stripe_direct_mrr_report.md', md);
    console.log('Report saved to stripe_direct_mrr_report.md');
}

verifyDirectStripe();
