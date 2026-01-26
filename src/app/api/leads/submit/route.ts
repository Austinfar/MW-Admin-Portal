import { NextRequest, NextResponse } from 'next/server'
import { upsertLead } from '@/lib/actions/lead-actions'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Basic validation
        if (!body.email || !body.firstName) {
            return NextResponse.json(
                { error: 'Missing required fields: email and firstName are required' },
                { status: 400 }
            )
        }

        const supabase = createAdminClient()
        const result = await upsertLead(supabase, {
            firstName: body.firstName,
            lastName: body.lastName || '',
            email: body.email,
            phone: body.phone || '',
            metadata: body.metadata || {},
            coachId: body.coachId
        })

        if (result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            leadId: result.leadId
        })

    } catch (error) {
        console.error('Error in lead submission API:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// Handle OPTIONS for CORS if called directly from browser (if needed in future)
export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    })
}
