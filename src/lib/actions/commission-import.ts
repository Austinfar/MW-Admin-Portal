'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentPayPeriod } from '@/lib/logic/commissions';

export interface ImportRow {
    coachEmail?: string;
    coachName?: string;
    clientName?: string;
    clientEmail?: string;
    date?: string;
    grossAmount?: number;
    commissionAmount?: number;
    notes?: string;
    role?: string;
    leadSource?: string;
}

export interface ImportResult {
    success: boolean;
    totalRows: number;
    imported: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
}

export interface ColumnMapping {
    coachEmail?: string;
    coachName?: string;
    clientName?: string;
    clientEmail?: string;
    date?: string;
    grossAmount?: string;
    commissionAmount?: string;
    notes?: string;
    role?: string;
    leadSource?: string;
}

/**
 * Parse CSV content and return rows as objects
 */
export async function parseCSV(content: string): Promise<{
    headers: string[];
    rows: Record<string, string>[];
}> {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        return { headers: [], rows: [] };
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]);

    // Parse data rows
    const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        return row;
    });

    return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

/**
 * Preview import data with mapping applied
 */
export async function previewImport(
    rows: Record<string, string>[],
    mapping: ColumnMapping
): Promise<{
    preview: ImportRow[];
    validCount: number;
    invalidCount: number;
    issues: Array<{ row: number; issue: string }>;
}> {
    const supabase = createAdminClient();
    const preview: ImportRow[] = [];
    const issues: Array<{ row: number; issue: string }> = [];
    let validCount = 0;
    let invalidCount = 0;

    // Fetch all coaches for matching
    const { data: coaches } = await supabase
        .from('users')
        .select('id, name, email')
        .in('job_title', ['coach', 'head_coach', 'admin_staff']);

    const coachByEmail = new Map((coaches || []).map(c => [c.email?.toLowerCase(), c]));
    const coachByName = new Map((coaches || []).map(c => [c.name?.toLowerCase(), c]));

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const importRow: ImportRow = {};

        // Apply mapping
        if (mapping.coachEmail && row[mapping.coachEmail]) {
            importRow.coachEmail = row[mapping.coachEmail];
        }
        if (mapping.coachName && row[mapping.coachName]) {
            importRow.coachName = row[mapping.coachName];
        }
        if (mapping.clientName && row[mapping.clientName]) {
            importRow.clientName = row[mapping.clientName];
        }
        if (mapping.clientEmail && row[mapping.clientEmail]) {
            importRow.clientEmail = row[mapping.clientEmail];
        }
        if (mapping.date && row[mapping.date]) {
            importRow.date = row[mapping.date];
        }
        if (mapping.grossAmount && row[mapping.grossAmount]) {
            const parsed = parseFloat(row[mapping.grossAmount].replace(/[$,]/g, ''));
            importRow.grossAmount = isNaN(parsed) ? undefined : parsed;
        }
        if (mapping.commissionAmount && row[mapping.commissionAmount]) {
            const parsed = parseFloat(row[mapping.commissionAmount].replace(/[$,]/g, ''));
            importRow.commissionAmount = isNaN(parsed) ? undefined : parsed;
        }
        if (mapping.notes && row[mapping.notes]) {
            importRow.notes = row[mapping.notes];
        }
        if (mapping.role && row[mapping.role]) {
            importRow.role = row[mapping.role];
        }
        if (mapping.leadSource && row[mapping.leadSource]) {
            importRow.leadSource = row[mapping.leadSource];
        }

        // Validation
        const rowIssues: string[] = [];

        // Must have coach email or name
        if (!importRow.coachEmail && !importRow.coachName) {
            rowIssues.push('No coach identifier');
        } else {
            // Try to match coach
            const coach = importRow.coachEmail
                ? coachByEmail.get(importRow.coachEmail.toLowerCase())
                : coachByName.get(importRow.coachName?.toLowerCase() || '');

            if (!coach) {
                rowIssues.push(`Coach not found: ${importRow.coachEmail || importRow.coachName}`);
            }
        }

        // Must have commission amount
        if (!importRow.commissionAmount && importRow.commissionAmount !== 0) {
            rowIssues.push('No commission amount');
        }

        if (rowIssues.length > 0) {
            invalidCount++;
            issues.push({ row: i + 2, issue: rowIssues.join(', ') }); // +2 for 1-indexed and header
        } else {
            validCount++;
        }

        preview.push(importRow);
    }

    return { preview, validCount, invalidCount, issues };
}

/**
 * Import commission data from parsed CSV
 */
export async function importCommissions(
    rows: Record<string, string>[],
    mapping: ColumnMapping,
    options: {
        targetPeriod?: string; // ISO date for period start
        markAsHistorical?: boolean;
    } = {}
): Promise<ImportResult> {
    const supabase = createAdminClient();
    const errors: Array<{ row: number; error: string }> = [];
    let imported = 0;
    let skipped = 0;

    // Fetch all coaches for matching
    const { data: coaches } = await supabase
        .from('users')
        .select('id, name, email')
        .in('job_title', ['coach', 'head_coach', 'admin_staff']);

    const coachByEmail = new Map((coaches || []).map(c => [c.email?.toLowerCase(), c]));
    const coachByName = new Map((coaches || []).map(c => [c.name?.toLowerCase(), c]));

    // Fetch clients for matching
    const { data: clients } = await supabase
        .from('clients')
        .select('id, name, email');

    const clientByEmail = new Map((clients || []).map(c => [c.email?.toLowerCase(), c]));
    const clientByName = new Map((clients || []).map(c => [c.name?.toLowerCase(), c]));

    // Get target period
    const { start: periodStart } = getCurrentPayPeriod();
    const targetPeriodStart = options.targetPeriod || periodStart.toISOString().split('T')[0];

    // Generate import batch ID
    const importId = `import-${Date.now()}`;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-indexed + header

        try {
            // Apply mapping
            const coachEmail = mapping.coachEmail ? row[mapping.coachEmail] : undefined;
            const coachName = mapping.coachName ? row[mapping.coachName] : undefined;
            const clientName = mapping.clientName ? row[mapping.clientName] : undefined;
            const clientEmail = mapping.clientEmail ? row[mapping.clientEmail] : undefined;
            const dateStr = mapping.date ? row[mapping.date] : undefined;
            const grossAmountStr = mapping.grossAmount ? row[mapping.grossAmount] : undefined;
            const commissionAmountStr = mapping.commissionAmount ? row[mapping.commissionAmount] : undefined;
            const notes = mapping.notes ? row[mapping.notes] : undefined;
            const role = mapping.role ? row[mapping.role] : 'coach';
            const leadSource = mapping.leadSource ? row[mapping.leadSource] : undefined;

            // Parse amounts
            const grossAmount = grossAmountStr
                ? parseFloat(grossAmountStr.replace(/[$,]/g, ''))
                : 0;
            const commissionAmount = commissionAmountStr
                ? parseFloat(commissionAmountStr.replace(/[$,]/g, ''))
                : undefined;

            if (!commissionAmount && commissionAmount !== 0) {
                errors.push({ row: rowNum, error: 'No commission amount' });
                skipped++;
                continue;
            }

            // Match coach
            const coach = coachEmail
                ? coachByEmail.get(coachEmail.toLowerCase())
                : coachByName.get((coachName || '').toLowerCase());

            if (!coach) {
                errors.push({ row: rowNum, error: `Coach not found: ${coachEmail || coachName}` });
                skipped++;
                continue;
            }

            // Match client (optional)
            let clientId: string | null = null;
            if (clientEmail) {
                const client = clientByEmail.get(clientEmail.toLowerCase());
                if (client) clientId = client.id;
            } else if (clientName) {
                const client = clientByName.get(clientName.toLowerCase());
                if (client) clientId = client.id;
            }

            // Parse date
            let entryDate = new Date();
            if (dateStr) {
                const parsed = new Date(dateStr);
                if (!isNaN(parsed.getTime())) {
                    entryDate = parsed;
                }
            }

            // Create ledger entry
            const { error: insertError } = await supabase
                .from('commission_ledger')
                .insert({
                    user_id: coach.id,
                    client_id: clientId,
                    payment_id: null, // No payment record for imports
                    gross_amount: grossAmount,
                    net_amount: grossAmount, // Assume no fee data
                    commission_amount: commissionAmount,
                    entry_type: 'import',
                    split_role: role?.toLowerCase() || 'coach',
                    split_percentage: grossAmount > 0 ? (commissionAmount / grossAmount) * 100 : 0,
                    source_schedule_id: null,
                    status: options.markAsHistorical ? 'paid' : 'pending',
                    payout_period_start: targetPeriodStart,
                    calculation_basis: {
                        source: 'csv_import',
                        import_id: importId,
                        original_row: rowNum,
                        original_data: {
                            coachEmail,
                            coachName,
                            clientName,
                            clientEmail,
                            date: dateStr,
                            grossAmount: grossAmountStr,
                            commissionAmount: commissionAmountStr,
                            notes,
                            role,
                            leadSource
                        }
                    },
                    created_at: entryDate.toISOString()
                });

            if (insertError) {
                errors.push({ row: rowNum, error: insertError.message });
                skipped++;
            } else {
                imported++;
            }
        } catch (err: any) {
            errors.push({ row: rowNum, error: err.message || 'Unknown error' });
            skipped++;
        }
    }

    return {
        success: errors.length === 0,
        totalRows: rows.length,
        imported,
        skipped,
        errors
    };
}
