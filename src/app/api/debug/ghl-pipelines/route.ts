
import { NextResponse } from 'next/server';
import { getGHLPipelines } from '@/lib/actions/ghl';

export async function GET() {
    try {
        const { pipelines, error } = await getGHLPipelines();
        if (error) {
            return NextResponse.json({ error }, { status: 500 });
        }
        return NextResponse.json({ pipelines }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
