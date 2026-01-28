
import { pushToGHL } from '../src/lib/services/ghl';

async function main() {
    const email = `test.ghl.sync.${Date.now()}@test.com`;
    console.log('Testing GHL Sync with email:', email);

    // 1. Test Sync (Create)
    const result = await pushToGHL({
        email,
        firstName: 'Test',
        lastName: 'GHL Sync',
        phone: '+15550000000',
        tags: ['test_tag'],
        status: 'New'
    });

    console.log('Sync Result:', result);

    if (result.success) {
        console.log('SUCCESS: Contact created.');
        if (result.ghlOpportunityId) {
            console.log('SUCCESS: Opportunity created with ID:', result.ghlOpportunityId);
        } else {
            console.warn('WARNING: Opportunity ID missing (expected if status maps to valid stage).');
        }
    } else {
        console.error('FAILURE:', result);
    }
}

main().catch(console.error);
