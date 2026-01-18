'use server';

import { getAuthorizationUrl } from '@/lib/ghl/oauth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function connectGHL() {
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    const redirectUri = `${protocol}://${host}/api/ghl/oauth/callback`;

    const url = getAuthorizationUrl(redirectUri);
    redirect(url);
}
