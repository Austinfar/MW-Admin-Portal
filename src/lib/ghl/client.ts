
import { GHL_CONFIG } from './config'

interface GHLResponse<T> {
    contacts?: T
    contact?: T
    meta?: any
}

interface GHLClientOptions {
    refreshToken?: string
    onTokenRefresh?: (tokens: { access_token: string; refresh_token: string; expires_in?: number }) => Promise<void>
}

// Basic wrapper for GHL API
export class GHLClient {
    private accessToken: string
    private refreshToken?: string
    private locationId: string
    private onTokenRefresh?: (tokens: { access_token: string; refresh_token: string; expires_in?: number }) => Promise<void>

    constructor(accessToken?: string, locationId?: string, options?: GHLClientOptions) {
        this.accessToken = accessToken || GHL_CONFIG.ACCESS_TOKEN || ''
        this.locationId = locationId || GHL_CONFIG.LOCATION_ID || ''
        this.refreshToken = options?.refreshToken
        this.onTokenRefresh = options?.onTokenRefresh

        if (!this.accessToken) {
            console.warn('GHL Access Token is missing. API calls will fail.')
        }
    }

    private async refreshTokens(): Promise<boolean> {
        if (!this.refreshToken) {
            console.error('[GHL Error] Cannot refresh token: No refresh token available.')
            return false
        }

        try {
            console.log('[GHL Info] Attempting to refresh access token...')
            const body = new URLSearchParams({
                client_id: GHL_CONFIG.CLIENT_ID || '',
                client_secret: GHL_CONFIG.CLIENT_SECRET || '',
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken,
                user_type: 'Location',
            })

            const res = await fetch('https://services.leadconnectorhq.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                body
            })

            if (!res.ok) {
                const text = await res.text()
                console.error('[GHL Error] Token refresh failed:', text)
                return false
            }

            const data = await res.json()

            // Update local state
            this.accessToken = data.access_token
            this.refreshToken = data.refresh_token

            // Notify callback to persist
            if (this.onTokenRefresh) {
                await this.onTokenRefresh(data)
            }

            console.log('[GHL Info] Token refreshed successfully.')
            return true

        } catch (error) {
            console.error('[GHL Error] Exception during token refresh:', error)
            return false
        }
    }

    private async request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T | null> {
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

            // Handle 401 Unauthorized (Expired Token)
            if (res.status === 401 && retry) {
                console.warn('[GHL Warning] 401 Unauthorized. Attempting refresh...')
                const refreshed = await this.refreshTokens()
                if (refreshed) {
                    // Retry the request with new token
                    return this.request<T>(endpoint, options, false) // false prevents infinite loop
                }
            }

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
        // Simple search wrapper
        return this.getAllContacts(query);
    }

    /**
     * Fetches contacts with pagination and optional filtering by pipeline.
     */
    async getAllContacts(query?: string, pipelineId?: string, pipelineStageId?: string) {
        // If filtering by pipeline, we MUST use the opportunities endpoint as /contacts doesn't support pipelineId
        if (pipelineId) {
            console.log(`[GHL Info] Pipeline filter detected (${pipelineId}). Delegating to getOpportunities...`);
            const { opportunities } = await this.getOpportunities(pipelineId);

            // Extract unique contacts from opportunities
            const contactMap = new Map();
            opportunities.forEach(op => {
                if (op.contact && op.contact.id) {
                    contactMap.set(op.contact.id, op.contact);
                }
            });

            const contacts = Array.from(contactMap.values());
            console.log(`[GHL Info] Extracted ${contacts.length} unique contacts from ${opportunities.length} opportunities.`);
            return { contacts };
        }

        const allContacts: any[] = [];
        let startAfterId: string | null = null;
        const MAX_PAGES = 100; // Safety limit
        let page = 1;
        let runningStartAfterId = ''; // Keep track to prevent loops

        while (page <= MAX_PAGES) {
            // Build URL with optional filters
            const params = new URLSearchParams({
                locationId: this.locationId,
                limit: '100'
            });

            if (query) params.append('query', query);
            // pipelineId is handled above via getOpportunities
            // pipelineStageId might not work on /contacts either, but leaving for now if user tries it without pipelineId
            if (pipelineStageId) params.append('pipelineStageId', pipelineStageId);
            if (startAfterId) params.append('startAfterId', startAfterId);

            const url = `/contacts/?${params.toString()}`;

            console.log(`[GHL Info] Fetching contacts page ${page}: ${url}`);

            const response = await this.request<{
                contacts: any[],
                meta?: {
                    startAfterId?: string,
                    startAfter?: string,
                    nextPageUrl?: string,
                    total?: number
                }
            }>(url);

            if (!response || !response.contacts || response.contacts.length === 0) {
                console.log(`[GHL Info] No more contacts found on page ${page}`);
                break;
            }

            allContacts.push(...response.contacts);
            console.log(`[GHL Info] Page ${page}: Got ${response.contacts.length} contacts. Total: ${allContacts.length}`);

            // Check for next page cursor
            const nextCursor = response.meta?.startAfterId || response.meta?.startAfter;

            if (nextCursor) {
                if (nextCursor === runningStartAfterId) {
                    console.warn('[GHL Loop] Next cursor is same as previous. Breaking.');
                    break;
                }
                startAfterId = nextCursor;
                runningStartAfterId = nextCursor;
                page++;
            } else if (response.contacts.length >= 100) {
                // Fallback: use last contact's ID as cursor
                const lastContact = response.contacts[response.contacts.length - 1];
                if (lastContact?.id && lastContact.id !== startAfterId) {
                    console.log(`[GHL Info] No meta cursor, using last contact ID: ${lastContact.id}`);
                    startAfterId = lastContact.id;
                    runningStartAfterId = lastContact.id;
                    page++;
                } else {
                    break;
                }
            } else {
                // Got less than 100, we're done
                break;
            }
        }

        console.log(`[GHL Info] Finished fetching contacts. Total: ${allContacts.length}`);
        return { contacts: allContacts };
    }

    async getPipelines() {
        // GHL v2 endpoint for pipelines is often under opportunities module
        const response = await this.request<{ pipelines: any[] }>(`/opportunities/pipelines?locationId=${this.locationId}`);
        return response;
    }

    async getCustomFields() {
        // Fetch all custom fields for the location
        return this.request<{ customFields: any[] }>(`/locations/${this.locationId}/customFields`)
    }

    async getOpportunities(pipelineId: string) {
        const allOpportunities: any[] = [];
        let page = 1;
        // Safety break to prevent infinite loops
        const MAX_PAGES = 100;

        // Initial Request
        let url = `/opportunities/search?location_id=${this.locationId}&pipeline_id=${pipelineId}&limit=100`;

        while (page <= MAX_PAGES) {
            const response = await this.request<{ opportunities: any[], meta?: any, next?: string }>(url);

            if (!response || !response.opportunities) {
                break;
            }

            const count = response.opportunities.length;
            allOpportunities.push(...response.opportunities);

            console.log(`[GHL Info] Page ${page} received ${count} opportunities.`);
            if (response.meta) {
                console.log(`[GHL debug] Page ${page} meta:`, JSON.stringify(response.meta));
            }

            // STRICT CHECK: Only fetch next page if we received a full page of 100 items.
            if (count < 100) {
                console.log(`[GHL Info] Page ${page} has less than 100 items (${count}). Finished fetching.`);
                break;
            }

            const metaNext = response.meta?.nextPageUrl || response.meta?.nextPage || (response as any).nextPageUrl;
            const metaStartAfter = response.meta?.startAfterId || response.meta?.startAfter || response.meta?.start_after;

            let nextRequestUrl = '';

            // STRATEGY CHANGE: Prioritize the explicit next URL provided by API.
            // This avoids guessing parameter names (startAfter vs start_after).
            if (metaNext) {
                // API gives us a direct link
                const nextUrlObj = new URL(metaNext);
                // Ensure we keep the relative path structure used by our request method
                // GHL might return full absolute URL, we just need path + query
                nextRequestUrl = `${nextUrlObj.pathname}${nextUrlObj.search}`;
                console.log(`[GHL Info] Using meta.nextPageUrl: ${nextRequestUrl}`);
            } else if (metaStartAfter) {
                // Use explicit start_after param
                nextRequestUrl = `/opportunities/search?location_id=${this.locationId}&pipeline_id=${pipelineId}&limit=100&start_after=${metaStartAfter}`;
                console.log(`[GHL Info] Using meta.startAfterId: ${nextRequestUrl}`);
            } else {
                // Fallback: We know we have 100 items but no meta cursor.
                const lastItem = response.opportunities[count - 1];
                if (lastItem?.id) {
                    console.log(`[GHL Info] Page ${page} full but no meta next. Using fallback cursor: ${lastItem.id}`);
                    nextRequestUrl = `/opportunities/search?location_id=${this.locationId}&pipeline_id=${pipelineId}&limit=100&start_after=${lastItem.id}`;
                }
            }

            if (nextRequestUrl) {
                // Safety check to prevent infinite loops (same URL)
                if (nextRequestUrl === url) {
                    console.warn('[GHL Warning] Pagination loop detected (Next URL same as Current). Stopping.', { current: url, next: nextRequestUrl });
                    break;
                }

                console.log(`[GHL Info] Advancing to Page ${page + 1}: ${nextRequestUrl}`);
                url = nextRequestUrl;
                page++;
            } else {
                console.log(`[GHL Info] No next page indicator found after Page ${page}. Stopping.`);
                break;
            }
        }

        return { opportunities: allOpportunities };
    }
    async sendSMS(contactId: string, message: string) {
        return this.request<{ conversationId: string; messageId: string }>('/conversations/messages', {
            method: 'POST',
            body: JSON.stringify({
                contactId,
                type: 'SMS',
                message
            })
        });
    }

    // Notes
    async getNotes(contactId: string) {
        return this.request<{ notes: any[] }>(`/contacts/${contactId}/notes`)
    }

    async createNote(contactId: string, content: string, userId?: string) {
        return this.request<{ note: any }>(`/contacts/${contactId}/notes`, {
            method: 'POST',
            body: JSON.stringify({
                body: content,
                userId // Optional: specific user ID if needed
            })
        })
    }

    async updateNote(contactId: string, noteId: string, content: string) {
        return this.request<{ note: any }>(`/contacts/${contactId}/notes/${noteId}`, {
            method: 'PUT',
            body: JSON.stringify({
                body: content
            })
        })
    }

    async deleteNote(contactId: string, noteId: string) {
        return this.request<{ success: boolean }>(`/contacts/${contactId}/notes/${noteId}`, {
            method: 'DELETE'
        })
    }

    // ============================================
    // DOCUMENT METHODS
    // ============================================

    /**
     * Send a document to a contact
     * @param contactId GHL contact ID
     * @param templateId Document template ID from GHL
     * @returns Document ID if successful
     */
    async sendDocument(contactId: string, templateId: string): Promise<{ documentId: string } | null> {
        const response = await this.request<{ document?: { id: string }; id?: string }>(`/contacts/${contactId}/documents`, {
            method: 'POST',
            body: JSON.stringify({
                templateId,
                // GHL auto-populates template variables from contact data
            })
        })

        if (response) {
            const documentId = response.document?.id || response.id
            if (documentId) {
                return { documentId }
            }
        }

        return null
    }

    /**
     * Get document status
     * @param documentId GHL document ID
     * @returns Document status and signed URL if available
     */
    async getDocumentStatus(documentId: string): Promise<{
        status: string
        signedUrl?: string
        viewedAt?: string
        signedAt?: string
    } | null> {
        const response = await this.request<{
            document?: {
                status: string
                signedDocumentUrl?: string
                viewedAt?: string
                signedAt?: string
            }
            status?: string
            signedDocumentUrl?: string
        }>(`/documents/${documentId}`)

        if (response) {
            const doc = response.document || response
            return {
                status: doc.status || 'unknown',
                signedUrl: doc.signedDocumentUrl,
                viewedAt: (doc as any).viewedAt,
                signedAt: (doc as any).signedAt,
            }
        }

        return null
    }

    /**
     * Void/cancel a document
     * @param documentId GHL document ID
     */
    async voidDocument(documentId: string): Promise<boolean> {
        const response = await this.request<{ success?: boolean }>(`/documents/${documentId}/void`, {
            method: 'POST'
        })

        return response?.success !== false
    }
}
