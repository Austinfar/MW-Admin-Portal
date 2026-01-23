'use client'

import { Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ClientHealthScore } from '@/components/clients/ClientHealthScore'
import { ClientRiskIndicators, type RiskIndicator } from '@/components/clients/ClientRiskIndicators'
import { Client } from '@/types/client'
import { HealthScoreResult } from '@/lib/logic/client-health'

interface ClientStickyHeaderProps {
    client: Client
    healthScore: HealthScoreResult
    riskIndicators: RiskIndicator[]
}

export function ClientStickyHeader({ client, healthScore, riskIndicators }: ClientStickyHeaderProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            case 'inactive':
                return 'bg-gray-500/15 text-gray-700 dark:text-gray-400'
            case 'lost':
                return 'bg-red-500/15 text-red-700 dark:text-red-400'
            case 'onboarding':
                return 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
            default:
                return 'bg-gray-500/15 text-gray-700'
        }
    }

    return (
        <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-white/5 -mx-4 md:-mx-8 px-4 md:px-8 py-4">
            <div className="flex flex-col gap-3">
                {/* Row 1: Avatar, Name, Status, Health */}
                <div className="flex items-center gap-3 sm:gap-4">
                    <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-primary/30 ring-offset-2 ring-offset-background shrink-0 shadow-[0_0_20px_var(--glow-primary)]">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${client.name}`} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                            {client.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground truncate">
                                {client.name}
                            </h1>
                            <Badge variant="secondary" className={`${getStatusColor(client.status)} text-[10px] sm:text-xs shrink-0`}>
                                {client.status.toUpperCase()}
                            </Badge>
                            <ClientHealthScore score={healthScore} />
                        </div>
                        <ClientRiskIndicators indicators={riskIndicators} />
                    </div>
                </div>

                {/* Row 2: Contact info and actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <a
                            href={`mailto:${client.email}`}
                            className="flex items-center gap-1.5 hover:text-primary transition-colors"
                        >
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate max-w-[180px] sm:max-w-none">{client.email}</span>
                        </a>
                        {client.phone && (
                            <a
                                href={`tel:${client.phone}`}
                                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                            >
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span>{client.phone}</span>
                            </a>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs bg-card/50 backdrop-blur-sm border-white/10 hover:border-primary/30 hover:bg-primary/10 transition-all duration-200"
                        >
                            Sync GHL
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
