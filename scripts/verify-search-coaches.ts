
import { searchGlobal } from '@/lib/actions/search-actions'

async function run() {
    console.log('Searching for "Austin"...')
    try {
        const results = await searchGlobal('Austin')
        console.log('Results:', JSON.stringify(results, null, 2))

        if (results.coaches.length > 0) {
            console.log('✅ Coaches found!')
        } else {
            console.log('⚠️ No coaches found.')
        }

        // Test Easter Egg trigger just in case (search for "100k month" - shouldn't return results from DB usually but logic in UI handles it)
        // But backend should handle empty/irrelevant usage gracefully
        const eggResults = await searchGlobal('100k month')
        console.log('Egg Results (Backend):', JSON.stringify(eggResults, null, 2))

    } catch (e) {
        console.error('Error:', e)
    }
}

run()
