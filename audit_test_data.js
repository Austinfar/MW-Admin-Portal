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

async function auditTestData() {
    console.log('Scanning for Potential Test Data...');

    // 1. Audit Clients
    const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .or('email.ilike.%test%,email.ilike.%example%,name.ilike.%test%,name.ilike.%demo%');

    console.log(`\nPotential Test Clients Found: ${clients?.length || 0}`);
    if (clients?.length) {
        clients.forEach(c => console.log(`- [Client] ${c.name} (${c.email}) - ID: ${c.id}`));
    }

    // 2. Audit Payments
    // Check for clients found above + any loose payments with weird descriptions
    // Also, check table for any columns indicating test mode? (We'll assume no for now)
    const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, status, payment_date, client_id, stripe_payment_id');

    // Filter payments linked to suspect clients
    const suspectClientIds = new Set(clients?.map(c => c.id) || []);
    const suspectPayments = payments?.filter(p => suspectClientIds.has(p.client_id));

    // Also check for very small amounts often used for testing ($1.00, $0.50)
    const smallPayments = payments?.filter(p => p.amount <= 1 && !suspectClientIds.has(p.client_id));

    console.log(`\nPotential Test Payments (Linked to Test Clients): ${suspectPayments?.length || 0}`);
    if (suspectPayments?.length) {
        suspectPayments.forEach(p => console.log(`- [Payment] $${p.amount} (${p.status}) - Date: ${p.payment_date} - ID: ${p.id}`));
    }

    console.log(`\nPotential Test Payments (Low Value <= $1): ${smallPayments?.length || 0}`);
    if (smallPayments?.length) {
        smallPayments.slice(0, 10).forEach(p => console.log(`- [Payment] $${p.amount} (${p.status}) - Date: ${p.payment_date} - ID: ${p.id}`));
        if (smallPayments.length > 10) console.log(`... and ${smallPayments.length - 10} more.`);
    }

    // Generate Report
    let markdown = `# Test Data Audit Report\n\n`;

    if (clients?.length) {
        markdown += `## Suspect Clients (${clients.length})\n`;
        markdown += `| Name | Email | ID |\n|---|---|---|\n`;
        clients.forEach(c => markdown += `| ${c.name} | ${c.email} | ${c.id} |\n`);
    }

    if (suspectPayments?.length) {
        markdown += `\n## Payments Linked to Test Clients (${suspectPayments.length})\n`;
        markdown += `| Amount | Date | Status | ID |\n|---|---|---|---|\n`;
        suspectPayments.forEach(p => markdown += `| $${p.amount} | ${p.payment_date} | ${p.status} | ${p.id} |\n`);
    }

    if (smallPayments?.length) {
        markdown += `\n## Low Value Payments (Potential Tests) (${smallPayments.length})\n`;
        markdown += `| Amount | Date | Status | ID |\n|---|---|---|---|\n`;
        smallPayments.forEach(p => markdown += `| $${p.amount} | ${p.payment_date} | ${p.status} | ${p.id} |\n`);
    }

    fs.writeFileSync('test_data_audit.md', markdown);
    console.log('\nReport saved to test_data_audit.md');
}

auditTestData();
