import { getLead } from '@/lib/actions/lead-actions'
import { getUserProfile } from '@/lib/actions/profile'
import { GHL_CONFIG } from '@/lib/ghl/config'
import { notFound } from 'next/navigation'
import { LeadDetailClient } from '@/components/leads/LeadDetailClient'

export default async function LeadPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const lead = await getLead(params.id)

    if (!lead) {
        notFound()
    }

    // Resolve coach name if needed
    let coachName: string | null = null;
    if (lead.metadata?.coach_selected && typeof lead.metadata.coach_selected === 'string') {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lead.metadata.coach_selected);
        if (isUuid) {
            const profile = await getUserProfile(lead.metadata.coach_selected);
            if (profile) coachName = profile.name;
        }
    }

    // Resolve setter name if needed
    let setterName: string | null = null;
    if (lead.booked_by_user_id) {
        const profile = await getUserProfile(lead.booked_by_user_id);
        if (profile) setterName = profile.name;
    }

    return (
        <LeadDetailClient
            lead={lead}
            ghlLocationId={GHL_CONFIG.LOCATION_ID}
            resolvedCoachName={coachName}
            resolvedSetterName={setterName}
        />
    )
}
