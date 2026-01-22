'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Save, Loader2, MessageSquare } from 'lucide-react'
import { updateSmsCheckinSettings } from '@/lib/actions/sms-checkin'
import { toast } from 'sonner'

interface SmsCheckinSettingsProps {
    initialSettings: {
        enabled: boolean
        messageTemplate: string
    }
}

export function SmsCheckinSettings({ initialSettings }: SmsCheckinSettingsProps) {
    const [enabled, setEnabled] = useState(initialSettings.enabled)
    const [messageTemplate, setMessageTemplate] = useState(initialSettings.messageTemplate)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const result = await updateSmsCheckinSettings({
                enabled,
                messageTemplate
            })

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('SMS check-in settings saved')
            }
        } catch (error) {
            toast.error('Failed to save settings')
        } finally {
            setIsSaving(false)
        }
    }

    const handleToggle = async (checked: boolean) => {
        setEnabled(checked)
        // Auto-save the toggle
        const result = await updateSmsCheckinSettings({ enabled: checked })
        if (result.error) {
            toast.error(result.error)
            setEnabled(!checked) // Revert on error
        } else {
            toast.success(checked ? 'SMS check-in enabled' : 'SMS check-in disabled')
        }
    }

    // Preview with sample name
    const previewMessage = messageTemplate.replace('{firstName}', 'John')

    return (
        <div className="space-y-4">
            {/* Enable/Disable Card */}
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-base">Automated Check-ins</CardTitle>
                            <CardDescription>
                                Send weekly SMS messages to clients on their designated check-in day
                            </CardDescription>
                        </div>
                        <Switch
                            checked={enabled}
                            onCheckedChange={handleToggle}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant={enabled ? 'default' : 'secondary'} className={enabled ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' : ''}>
                            {enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <span>Runs daily at 11:00 AM ET (day before check-in)</span>
                    </div>
                </CardContent>
            </Card>

            {/* Message Template Card */}
            <Card className="bg-card/50 backdrop-blur-xl border-white/5">
                <CardHeader>
                    <CardTitle className="text-base">Message Template</CardTitle>
                    <CardDescription>
                        Customize the check-in message sent to clients. Use <code className="text-xs bg-muted px-1 py-0.5 rounded">{'{firstName}'}</code> to personalize with the client&apos;s first name.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="template">Message</Label>
                        <Textarea
                            id="template"
                            value={messageTemplate}
                            onChange={(e) => setMessageTemplate(e.target.value)}
                            rows={3}
                            className="resize-none"
                            placeholder="Hey {firstName}! Just checking in..."
                        />
                        <p className="text-xs text-muted-foreground">
                            {messageTemplate.length} characters
                            {messageTemplate.length > 160 && (
                                <span className="text-amber-500 ml-2">(May be sent as multiple SMS segments)</span>
                            )}
                        </p>
                    </div>

                    {/* Preview */}
                    <div className="space-y-2">
                        <Label>Preview</Label>
                        <div className="bg-muted/50 rounded-lg p-4 border border-white/5">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                    <MessageSquare className="h-4 w-4 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">To: John Doe</p>
                                    <p className="text-sm">{previewMessage}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Template
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
