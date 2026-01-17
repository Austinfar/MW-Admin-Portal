import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const body = await req.json();
        const { record_id, status, report_html, error_message, client_name } = body;

        if (!record_id || !status) {
            return NextResponse.json(
                { error: 'Missing required fields: record_id and status' },
                { status: 400 }
            );
        }

        // Validate status allows only specific values
        const validStatuses = ['transcribing', 'analyzing', 'completed', 'failed'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        if (status === 'completed' && report_html) {
            updateData.report_html = report_html;
        }

        if (client_name) {
            updateData.client_name = client_name;
        }

        if (status === 'failed' && error_message) {
            // You might want a specific column for errors or just log it
            console.error(`Analysis failed for record ${record_id}:`, error_message);
        }

        const { error } = await supabase
            .from('sales_call_logs')
            .update(updateData)
            .eq('id', record_id);

        if (error) {
            console.error('Error updating record:', error);
            return NextResponse.json(
                { error: 'Failed to update record' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
