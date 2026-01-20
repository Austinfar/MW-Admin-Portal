'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    Activity,
    Database,
    Shield,
    HardDrive,
    CreditCard,
    Globe,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Wifi,
    WifiOff,
    DollarSign,
    TrendingUp,
    Server,
    Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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

// Cost estimation tiers
interface CostTier {
    name: string
    range: string
    monthlyBase: number
    features: string[]
}

const SUPABASE_TIERS: CostTier[] = [
    { name: 'Free', range: '0 users', monthlyBase: 0, features: ['500MB DB', '1GB storage', '50K MAU'] },
    { name: 'Pro', range: '1-100 users', monthlyBase: 25, features: ['8GB DB', '100GB storage', '100K MAU'] },
    { name: 'Team', range: '100+ users', monthlyBase: 599, features: ['Unlimited DB', 'Unlimited storage', 'SOC2'] },
]

const VERCEL_TIERS: CostTier[] = [
    { name: 'Hobby', range: 'Personal', monthlyBase: 0, features: ['100GB bandwidth', '6000 min build'] },
    { name: 'Pro', range: 'Teams', monthlyBase: 20, features: ['1TB bandwidth', 'Unlimited builds'] },
    { name: 'Enterprise', range: 'Large', monthlyBase: 0, features: ['Custom pricing', 'SLA'] },
]

function CostEstimationCard() {
    // You can make this dynamic based on actual usage data if available
    const estimatedUsers = 50 // Could be fetched from DB
    const supabaseTier = SUPABASE_TIERS[1] // Pro tier
    const vercelTier = VERCEL_TIERS[1] // Pro tier

    const totalEstimate = supabaseTier.monthlyBase + vercelTier.monthlyBase

    return (
        <div className="p-4 rounded-lg border border-border/50 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
            <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <DollarSign className="h-4 w-4 text-blue-400" />
                </div>
                <h4 className="font-medium text-sm">Estimated Monthly Cost</h4>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Supabase */}
                <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Database className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-medium">Supabase</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto">
                            {supabaseTier.name}
                        </Badge>
                    </div>
                    <div className="text-xl font-bold text-emerald-400">
                        ${supabaseTier.monthlyBase}
                        <span className="text-xs text-muted-foreground font-normal">/mo</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        {supabaseTier.features.slice(0, 2).join(' • ')}
                    </p>
                </div>

                {/* Vercel */}
                <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-white" />
                        <span className="text-xs font-medium">Vercel</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-auto">
                            {vercelTier.name}
                        </Badge>
                    </div>
                    <div className="text-xl font-bold text-white">
                        ${vercelTier.monthlyBase}
                        <span className="text-xs text-muted-foreground font-normal">/mo</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        {vercelTier.features.slice(0, 2).join(' • ')}
                    </p>
                </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-3 border-t border-border/30">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Estimated Total</span>
                </div>
                <div className="text-lg font-bold text-neon-green">
                    ${totalEstimate}
                    <span className="text-xs text-muted-foreground font-normal">/mo</span>
                </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Based on Pro tiers • Actual costs may vary with usage
            </p>
        </div>
    )
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
    'Database': Database,
    'Authentication': Shield,
    'Storage': HardDrive,
    'Stripe': CreditCard,
    'GoHighLevel': Globe,
}

const STATUS_CONFIG = {
    healthy: {
        label: 'Healthy',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        icon: CheckCircle2,
        pulse: 'bg-green-500',
    },
    degraded: {
        label: 'Degraded',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        icon: AlertTriangle,
        pulse: 'bg-yellow-500',
    },
    down: {
        label: 'Down',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        icon: XCircle,
        pulse: 'bg-red-500',
    },
}

function formatLatency(ms?: number): string {
    if (ms === undefined) return '--'
    if (ms < 100) return `${ms}ms`
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

function ServiceCard({ service }: { service: ServiceHealth }) {
    const Icon = SERVICE_ICONS[service.name] || Activity
    const statusConfig = STATUS_CONFIG[service.status]
    const StatusIcon = statusConfig.icon

    return (
        <div className={cn(
            "relative p-4 rounded-lg border transition-all duration-300",
            statusConfig.bgColor,
            statusConfig.borderColor,
        )}>
            {/* Pulse indicator */}
            <div className="absolute top-3 right-3">
                <span className="relative flex h-3 w-3">
                    <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        statusConfig.pulse,
                    )} />
                    <span className={cn(
                        "relative inline-flex rounded-full h-3 w-3",
                        statusConfig.pulse,
                    )} />
                </span>
            </div>

            <div className="flex items-start gap-3">
                <div className={cn(
                    "p-2 rounded-lg",
                    statusConfig.bgColor,
                )}>
                    <Icon className={cn("h-5 w-5", statusConfig.color)} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">{service.name}</h4>
                        <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
                    </div>

                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {service.message || statusConfig.label}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {service.latency !== undefined && (
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatLatency(service.latency)}
                            </span>
                        )}
                        <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 py-0", statusConfig.color, statusConfig.borderColor)}
                        >
                            {statusConfig.label}
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function SystemHealthDashboard() {
    const [health, setHealth] = useState<SystemHealth | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(true)

    const fetchHealth = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)

            const response = await fetch('/api/health')
            const data = await response.json()

            setHealth(data)
            setLastRefresh(new Date())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch health status')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchHealth()
    }, [fetchHealth])

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return

        const interval = setInterval(fetchHealth, 30000)
        return () => clearInterval(interval)
    }, [autoRefresh, fetchHealth])

    const overallConfig = health ? STATUS_CONFIG[health.overall] : null

    return (
        <Card className="border-border/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-lg",
                            overallConfig?.bgColor || 'bg-muted',
                        )}>
                            <Activity className={cn(
                                "h-5 w-5",
                                overallConfig?.color || 'text-muted-foreground',
                            )} />
                        </div>
                        <div>
                            <CardTitle className="text-lg">System Health</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                                {lastRefresh && (
                                    <span>
                                        Last checked: {lastRefresh.toLocaleTimeString()}
                                    </span>
                                )}
                                {autoRefresh && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                        Auto-refresh
                                    </Badge>
                                )}
                            </CardDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Overall status badge */}
                        {health && (
                            <Badge
                                className={cn(
                                    "gap-1",
                                    overallConfig?.bgColor,
                                    overallConfig?.color,
                                    overallConfig?.borderColor,
                                )}
                                variant="outline"
                            >
                                {autoRefresh ? (
                                    <Wifi className="h-3 w-3" />
                                ) : (
                                    <WifiOff className="h-3 w-3" />
                                )}
                                {overallConfig?.label}
                            </Badge>
                        )}

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={cn(
                                "h-8 w-8 p-0",
                                autoRefresh && "border-neon-green/50 text-neon-green"
                            )}
                            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
                        >
                            {autoRefresh ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                        </Button>

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={fetchHealth}
                            disabled={isLoading}
                            className="h-8 gap-1.5"
                        >
                            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {error ? (
                    <div className="flex items-center justify-center py-8 text-center">
                        <div className="space-y-2">
                            <XCircle className="h-10 w-10 text-red-400 mx-auto" />
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <Button size="sm" variant="outline" onClick={fetchHealth}>
                                Try Again
                            </Button>
                        </div>
                    </div>
                ) : isLoading && !health ? (
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : health ? (
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {health.services.map((service) => (
                                <ServiceCard key={service.name} service={service} />
                            ))}
                        </div>

                        {/* Cost Estimation */}
                        <CostEstimationCard />
                    </div>
                ) : null}

                {/* Uptime summary */}
                {health && (
                    <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            {health.services.filter(s => s.status === 'healthy').length} of {health.services.length} services operational
                        </span>
                        <span>
                            Avg. latency: {Math.round(
                                health.services
                                    .filter(s => s.latency !== undefined)
                                    .reduce((acc, s) => acc + (s.latency || 0), 0) /
                                health.services.filter(s => s.latency !== undefined).length || 0
                            )}ms
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
