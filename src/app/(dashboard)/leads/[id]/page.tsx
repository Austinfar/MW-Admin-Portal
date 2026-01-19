import { getLead } from '@/lib/actions/lead-actions'
import { GHL_CONFIG } from '@/lib/ghl/config'
import { notFound } from 'next/navigation'
import { LeadDetailClient } from '@/components/leads/LeadDetailClient'

export default async function LeadPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const lead = await getLead(params.id)

    if (!lead) {
        notFound()
    }

    return (
        <LeadDetailClient
            lead={lead}
            ghlLocationId={GHL_CONFIG.LOCATION_ID}
        />
    )
}
