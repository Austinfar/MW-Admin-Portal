
import { NextResponse } from 'next/server';
import { syncCallBookedLeads } from '@/lib/actions/ghl';

export async function GET() {
    try {
        const result = await syncCallBookedLeads();
        return NextResponse.json(result, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
