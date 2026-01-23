'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Calendar, Save, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { getGlobalTeamCalendarUrl, setGlobalTeamCalendarUrl } from '@/lib/actions/cal-links'

export function BusinessSettingsCard() {
    const [globalCalendarUrl, setGlobalCalendarUrlState] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        async function fetchSettings() {
            try {
                const url = await getGlobalTeamCalendarUrl()
                setGlobalCalendarUrlState(url || '')
            } catch (error) {
                console.error('Failed to fetch business settings:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSettings()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)

        try {
            const result = await setGlobalTeamCalendarUrl(globalCalendarUrl)

            if (result.success) {
                toast.success('Settings saved successfully')
                setSaved(true)
                setTimeout(() => setSaved(false), 2000)
            } else {
                toast.error(result.error || 'Failed to save settings')
            }
        } catch (error) {
            console.error('Failed to save settings:', error)
            toast.error('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Cal.com Settings
                </CardTitle>
                <CardDescription>
                    Configure your team&apos;s Cal.com calendar integration
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Global Team Calendar URL */}
                <div className="space-y-2">
                    <Label htmlFor="globalCalendarUrl" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Global Team Calendar URL
                    </Label>
                    <Input
                        id="globalCalendarUrl"
                        placeholder="https://cal.com/your-team/sales-call"
                        value={globalCalendarUrl}
                        onChange={(e) => setGlobalCalendarUrlState(e.target.value)}
                        className="bg-background/50 border-white/10"
                    />
                    <p className="text-xs text-muted-foreground">
                        This is the round-robin calendar link that setters will use to book sales calls.
                        It distributes bookings across all available team members.
                    </p>
                </div>

                {/* Webhook Info */}
                <div className="rounded-lg bg-white/5 p-4 space-y-2">
                    <h4 className="text-sm font-medium">Webhook Endpoint</h4>
                    <code className="block text-xs bg-black/30 px-3 py-2 rounded font-mono break-all">
                        https://admin.mwfitnesscoaching.com/api/webhooks/cal
                    </code>
                    <p className="text-xs text-muted-foreground">
                        Configure this URL in your Cal.com webhook settings to receive booking notifications.
                        Subscribe to: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED, MEETING_STARTED, MEETING_ENDED, BOOKING_NO_SHOW_UPDATED
                    </p>
                </div>

                {/* Save Button */}
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-primary hover:bg-primary/90"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : saved ? (
                        <>
                            <Check className="w-4 h-4 mr-2" />
                            Saved
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Settings
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    )
}
