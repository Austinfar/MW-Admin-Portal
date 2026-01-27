export function buildBookingUrl(
    baseUrl: string,
    source: 'company-driven' | 'coach-driven',
    guests?: string[]
): string {
    if (!baseUrl) return ''

    const url = new URL(baseUrl)

    // Set source
    url.searchParams.set('source', source)

    // Append guests if provided
    if (guests && guests.length > 0) {
        // Cal.com uses 'guests' parameter which can be repeated or comma-separated
        // For a single guest, we can just set it. For multiple, we might need to append.
        // Let's assume comma-separated for now as it's standard URL encoding for arrays in some systems,
        // but Cal.com actually supports multiple 'guests' keys. 
        // URLSearchParams.append supports multiple keys.

        guests.forEach(guest => {
            url.searchParams.append('guests', guest)
        })
    }

    // Check for global auto-invite email env var
    const autoInviteEmail = process.env.NEXT_PUBLIC_FIREFLIES_EMAIL
    if (autoInviteEmail) {
        // Check if already added to avoid duplicates
        const currentGuests = url.searchParams.getAll('guests')
        if (!currentGuests.includes(autoInviteEmail)) {
            url.searchParams.append('guests', autoInviteEmail)
        }
    }

    return url.toString()
}
