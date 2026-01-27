'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { unstable_cache } from 'next/cache';

export interface CoachUser {
    id: string;
    name: string;
    slug: string | null;
    avatar_url: string | null;
}

async function _getCoaches(): Promise<CoachUser[]> {
    const supabase = createAdminClient();

    // Fetch users who have job_title 'coach' OR role 'coach'
    // We'll lean on 'job_title' as primary indicator based on user's comment
    // But let's be inclusive.
    const { data, error } = await supabase
        .from('users')
        .select('id, name, slug, avatar_url')
        .or('job_title.ilike.coach,role.in.(coach,admin,owner)')
    // Note: Admin/Owner might also be coaches. 
    // User specifically said "display any coach... that has the coach job type"
    // So checking job_title is most accurate.
    // Let's refine query to be stricter if needed: job_title ILIKE '%coach%'
    // Or just job_title = 'coach'

    // Let's try a safer query first that matches the "job_title" field we saw.
    // We saw "job_title: coach" in the schema check.

    // Re-querying specifically for job_title='coach' is safest for "coach job type".
    const { data: coaches, error: coachError } = await supabase
        .from('users')
        .select('id, name, slug, avatar_url')
        .ilike('job_title', '%coach%')
        .eq('is_active', true)
        .order('name');

    if (coachError) {
        console.error('Error fetching coaches:', coachError);
        return [];
    }

    return coaches || [];
}

export const getCoaches = unstable_cache(
    _getCoaches,
    ['coaches-list'],
    { revalidate: 60, tags: ['users'] }
);
