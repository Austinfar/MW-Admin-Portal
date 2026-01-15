import { GHL_CONFIG } from './config'

interface GHLResponse<T> {
    contacts?: T
    contact?: T
    meta?: any
}

// Basic wrapper for GHL API
export class GHLClient {
    private accessToken: string
    private locationId: string

    constructor(accessToken?: string, locationId?: string) {
        this.accessToken = accessToken || GHL_CONFIG.ACCESS_TOKEN || ''
        this.locationId = locationId || GHL_CONFIG.LOCATION_ID || ''

        if (!this.accessToken) {
            console.warn('GHL Access Token is missing. API calls will fail.')
        }
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
        if (!this.accessToken) {
            console.error('[GHL Error] No access token provided for request');
            return null;
        }

        const url = `${GHL_CONFIG.API_URL}${endpoint}`
        console.log(`[GHL Info] Requesting: ${url}`);

        const headers = {
            'Authorization': `Bearer ${this.accessToken}`,
            'Version': GHL_CONFIG.API_VERSION,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
        }

        try {
            const res = await fetch(url, { ...options, headers })
            if (!res.ok) {
                const text = await res.text();
                console.error(`GHL API Error: ${res.statusText}`, text)
                return null
            }
            return await res.json()
        } catch (error) {
            console.error('GHL Request Failed:', error)
            return null
        }
    }

    async getContact(id: string) {
        return this.request<{ contact: any }>(`/contacts/${id}`)
    }

    async updateContact(id: string, data: any) {
        return this.request<{ contact: any }>(`/contacts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async searchContacts(query: string) {
        return this.request<{ contacts: any[] }>(`/contacts/?query=${query}&locationId=${this.locationId}`)
    }

    async getPipelines() {
        // GHL v2 endpoint for pipelines is often under opportunities module
        const response = await this.request<{ pipelines: any[] }>(`/opportunities/pipelines?locationId=${this.locationId}`);
        return response;
    }

    async getOpportunities(pipelineId: string) {
        const allOpportunities: any[] = [];
        let page = 1;
        // Safety break to prevent infinite loops
        const MAX_PAGES = 50;

        // Initial Request
        let url = `/opportunities/search?location_id=${this.locationId}&pipeline_id=${pipelineId}&limit=100`;

        while (page <= MAX_PAGES) {
            const response = await this.request<{ opportunities: any[], meta?: any, next?: string }>(url);

            if (!response || !response.opportunities) {
                break;
            }

            allOpportunities.push(...response.opportunities);

            // Check for next page indication (GHL V2 usually provides 'meta.nextPageUrl' or just 'nextPageUrl')
            // Trying standard GHL pagination patterns
            const nextUrl = response.meta?.nextPageUrl || response.meta?.nextPage || (response as any).nextPageUrl;

            if (nextUrl) {
                // Next URL might be absolute or relative, handling both would be complex without a library, 
                // but GHL often gives a full URL.
                // However, request() prepends base URL. If nextUrl is full, we need to handle that.
                // Simpler approach for Search endpoint usually supports 'startAfter' or 'startAfterId' from the last item
                // IF nextUrl is not easily usable.
                // BUT, let's try to just follow if we got a full page (100 items).

                // If we didn't receive a full page, we are likely done
                if (response.opportunities.length < 100) {
                    break;
                }

                // If GHL returns a full text URL for next page (common in v2), we need to extract the query params or path.
                // For now, let's assume we can continue if we received 100 items by using the 'startAfter' logic if specific meta isn't clear.
                // Actually, let's stick to a robust simpler logic:
                // If we got 100 items, verify if there's a simple 'startAfterId' or 'start_after' logic we can assume.
                // WITHOUT DOCS, SAFE FALLBACK:
                // Only fetching first 100 for now would be an improvement over 20.
                // Let's rely on the user feedback if 100 is not enough or try to look for startAfter.

                // For 'opportunities/search', often it uses `startAfterId`.
                if (response.meta?.startAfterId) {
                    url = `/opportunities/search?location_id=${this.locationId}&pipeline_id=${pipelineId}&limit=100&startAfterId=${response.meta.startAfterId}`;
                } else if (response.meta?.nextPageUrl) {
                    // If it gives a URL, it might be tricky to plug into our current request() helper which appends base.
                    // Let's Parse properly.
                    const nextUrlObj = new URL(response.meta.nextPageUrl);
                    // We just need the path and query
                    url = `${nextUrlObj.pathname}${nextUrlObj.search}`;
                } else {
                    // No obvious next page token, break
                    break;
                }
            } else {
                break;
            }

            page++;
        }

        return { opportunities: allOpportunities };
    }
}
