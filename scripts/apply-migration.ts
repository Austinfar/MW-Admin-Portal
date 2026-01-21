/**
 * Apply commission system migration directly via Supabase API
 * Run with: npx tsx scripts/apply-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    console.log('📦 Applying Commission System V2 Migration...\n');

    // Read the migration file
    const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260120_commission_system_v2.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split into individual statements (basic splitting - may need adjustment for complex SQL)
    const statements = migrationSQL
        .split(/;[\s]*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.substring(0, 60).replace(/\n/g, ' ');

        try {
            const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });

            if (error) {
                // Many errors are expected (like "already exists")
                if (error.message?.includes('already exists') ||
                    error.message?.includes('duplicate key') ||
                    error.message?.includes('does not exist')) {
                    console.log(`⏭️  [${i + 1}] Skipped (already applied): ${preview}...`);
                } else {
                    console.log(`⚠️  [${i + 1}] Warning: ${error.message?.substring(0, 80)}`);
                    errorCount++;
                }
            } else {
                console.log(`✅ [${i + 1}] Applied: ${preview}...`);
                successCount++;
            }
        } catch (e: any) {
            console.log(`❌ [${i + 1}] Error: ${e.message?.substring(0, 80)}`);
            errorCount++;
        }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors/Warnings: ${errorCount}`);
    console.log(`   Skipped: ${statements.length - successCount - errorCount}`);
}

applyMigration().catch(console.error);
