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
                console.log(`[GHL DEBUG] Page ${page} received. Meta:`, response.meta);

                let nextRequestUrl = '';

                if (response.meta?.startAfterId) {
                    nextRequestUrl = `/opportunities/search?location_id=${this.locationId}&pipeline_id=${pipelineId}&limit=100&startAfterId=${response.meta.startAfterId}`;
                } else if (response.meta?.nextPageUrl) {
                    const nextUrlObj = new URL(response.meta.nextPageUrl);
                    nextRequestUrl = `${nextUrlObj.pathname}${nextUrlObj.search}`;
                } else if (response.opportunities.length === 100) {
                    // Fallback: If we got a full page but no meta, try using the last item's ID as startAfterId
                    const lastItem = response.opportunities[response.opportunities.length - 1];
                    console.log('[GHL DEBUG] Page full (100 items), no meta.next. LastItem ID:', lastItem?.id);

                    if (lastItem && lastItem.id) {
                        console.log('[GHL DEBUG] Constructing manual next page URL using startAfterId:', lastItem.id);
                        nextRequestUrl = `/opportunities/search?location_id=${this.locationId}&pipeline_id=${pipelineId}&limit=100&startAfterId=${lastItem.id}`;
                    }
                }

                // If no next URL found, or if it's the exact same URL as before (infinite loop), break
                if (!nextRequestUrl) {
                    console.warn('[GHL Warning] No next page URL could be determined. Stopping.');
                    break;
                }

                if (nextRequestUrl === url) {
                    console.warn('[GHL Warning] Pagination loop detected (URL did not change). Stopping.', { current: url, next: nextRequestUrl });
                    break;
                }

                console.log('[GHL Info] Advancing to next page:', nextRequestUrl);
                url = nextRequestUrl;
            } else {
                console.log(`[GHL Info] No nextUrl trigger found for Page ${page}. Stopping.`);
                break;
            }

            page++;
        }

        return { opportunities: allOpportunities };
    }
}
