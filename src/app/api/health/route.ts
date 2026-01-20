import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

// Types for health check responses
interface ServiceHealth {
    name: string
    status: 'healthy' | 'degraded' | 'down'
    latency?: number
    message?: string
    lastChecked: string
}

interface SystemHealth {
    overall: 'healthy' | 'degraded' | 'down'
    services: ServiceHealth[]
    timestamp: string
}

// Check Supabase database connection
async function checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now()
    try {
        const admin = createAdminClient()
        const { data, error } = await admin.from('users').select('id').limit(1)

        if (error) {
            return {
                name: 'Database',
                status: 'down',
                message: error.message,
                lastChecked: new Date().toISOString(),
            }
        }

        const latency = Date.now() - start
        return {
            name: 'Database',
            status: latency > 2000 ? 'degraded' : 'healthy',
            latency,
            message: latency > 2000 ? 'High latency detected' : 'Connected',
            lastChecked: new Date().toISOString(),
        }
    } catch (error) {
        return {
            name: 'Database',
            status: 'down',
            message: error instanceof Error ? error.message : 'Connection failed',
            lastChecked: new Date().toISOString(),
        }
    }
}

// Check Supabase Auth service
async function checkAuth(): Promise<ServiceHealth> {
    const start = Date.now()
    try {
        const admin = createAdminClient()
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })

        if (error) {
            return {
                name: 'Authentication',
                status: 'down',
                message: error.message,
                lastChecked: new Date().toISOString(),
            }
        }

        const latency = Date.now() - start
        return {
            name: 'Authentication',
            status: latency > 2000 ? 'degraded' : 'healthy',
            latency,
            message: 'Auth service responding',
            lastChecked: new Date().toISOString(),
        }
    } catch (error) {
        return {
            name: 'Authentication',
            status: 'down',
            message: error instanceof Error ? error.message : 'Auth check failed',
            lastChecked: new Date().toISOString(),
        }
    }
}

// Check Supabase Storage
async function checkStorage(): Promise<ServiceHealth> {
    const start = Date.now()
    try {
        const admin = createAdminClient()
        const { data, error } = await admin.storage.listBuckets()

        if (error) {
            return {
                name: 'Storage',
                status: 'down',
                message: error.message,
                lastChecked: new Date().toISOString(),
            }
        }

        const latency = Date.now() - start
        return {
            name: 'Storage',
            status: latency > 2000 ? 'degraded' : 'healthy',
            latency,
            message: `${data?.length || 0} buckets available`,
            lastChecked: new Date().toISOString(),
        }
    } catch (error) {
        return {
            name: 'Storage',
            status: 'down',
            message: error instanceof Error ? error.message : 'Storage check failed',
            lastChecked: new Date().toISOString(),
        }
    }
}

// Check Stripe API
async function checkStripe(): Promise<ServiceHealth> {
    const start = Date.now()
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return {
                name: 'Stripe',
                status: 'down',
                message: 'API key not configured',
                lastChecked: new Date().toISOString(),
            }
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

        // Simple API call to verify connectivity
        await stripe.balance.retrieve()

        const latency = Date.now() - start
        return {
            name: 'Stripe',
            status: latency > 3000 ? 'degraded' : 'healthy',
            latency,
            message: 'Connected to Stripe',
            lastChecked: new Date().toISOString(),
        }
    } catch (error) {
        return {
            name: 'Stripe',
            status: 'down',
            message: error instanceof Error ? error.message : 'Stripe check failed',
            lastChecked: new Date().toISOString(),
        }
    }
}

// Check external API (example: GHL if configured)
async function checkExternalAPIs(): Promise<ServiceHealth> {
    const start = Date.now()
    try {
        // Check if GHL is configured
        const ghlApiKey = process.env.GHL_API_KEY
        if (!ghlApiKey) {
            return {
                name: 'GoHighLevel',
                status: 'healthy',
                message: 'Not configured (optional)',
                lastChecked: new Date().toISOString(),
            }
        }

        // Simple connectivity check
        const response = await fetch('https://services.leadconnectorhq.com/contacts/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ghlApiKey}`,
                'Version': '2021-07-28',
            },
        })

        const latency = Date.now() - start

        if (!response.ok && response.status !== 401) {
            return {
                name: 'GoHighLevel',
                status: 'degraded',
                latency,
                message: `HTTP ${response.status}`,
                lastChecked: new Date().toISOString(),
            }
        }

        return {
            name: 'GoHighLevel',
            status: latency > 3000 ? 'degraded' : 'healthy',
            latency,
            message: 'API reachable',
            lastChecked: new Date().toISOString(),
        }
    } catch (error) {
        return {
            name: 'GoHighLevel',
            status: 'down',
            message: error instanceof Error ? error.message : 'Check failed',
            lastChecked: new Date().toISOString(),
        }
    }
}

// Main health check handler
export async function GET() {
    try {
        // Run all health checks in parallel
        const [database, auth, storage, stripe, externalAPIs] = await Promise.all([
            checkDatabase(),
            checkAuth(),
            checkStorage(),
            checkStripe(),
            checkExternalAPIs(),
        ])

        const services = [database, auth, storage, stripe, externalAPIs]

        // Determine overall health
        const hasDown = services.some(s => s.status === 'down')
        const hasDegraded = services.some(s => s.status === 'degraded')

        const overall: SystemHealth['overall'] = hasDown
            ? 'down'
            : hasDegraded
                ? 'degraded'
                : 'healthy'

        const response: SystemHealth = {
            overall,
            services,
            timestamp: new Date().toISOString(),
        }

        return NextResponse.json(response, {
            status: overall === 'down' ? 503 : 200,
        })
    } catch (error) {
        return NextResponse.json({
            overall: 'down',
            services: [],
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Health check failed',
        }, { status: 500 })
    }
}
