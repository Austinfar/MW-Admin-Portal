import { getCurrentUserAccess } from '@/lib/auth-utils'
import { createClient } from '@/lib/supabase/server'
import { getRoadmapStats, getFeatureRequests, getTags, getMilestones, getActiveAnnouncements } from '@/lib/actions/feature-requests'
import { RoadmapPage } from '@/components/roadmap/RoadmapPage'

export const metadata = {
    title: 'Feature Requests & Roadmap | MW Systems',
    description: 'Submit feature requests and view the product roadmap',
}

export default async function RoadmapPageRoute() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [userAccess, stats, initialRequests, tags, milestones, announcements] = await Promise.all([
        getCurrentUserAccess(),
        getRoadmapStats(),
        getFeatureRequests({}, { field: 'priority_score', direction: 'desc' }, { page: 1, limit: 20 }),
        getTags(),
        getMilestones(),
        getActiveAnnouncements(),
    ])

    const isSuperAdmin = userAccess?.role === 'super_admin'

    return (
        <RoadmapPage
            initialStats={stats}
            initialRequests={initialRequests}
            initialTags={tags}
            initialMilestones={milestones}
            announcements={announcements}
            isSuperAdmin={isSuperAdmin}
            currentUserId={user?.id}
        />
    )
}

