'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    FileText,
    Send,
    Eye,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    RefreshCw,
    ExternalLink,
    Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
    getClientAgreements,
    sendAgreement,
    voidAgreement,
    resendAgreement,
    type Agreement,
} from '@/lib/actions/agreements'

interface AgreementSectionProps {
    clientId: string
    clientName: string
    hasGhlContactId: boolean
}

const statusConfig: Record<Agreement['status'], {
    label: string
    color: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ElementType
}> = {
    draft: { label: 'Draft', color: 'secondary', icon: FileText },
    sent: { label: 'Sent', color: 'default', icon: Send },
    viewed: { label: 'Viewed', color: 'default', icon: Eye },
    signed: { label: 'Signed', color: 'default', icon: CheckCircle2 },
    voided: { label: 'Voided', color: 'destructive', icon: XCircle },
    expired: { label: 'Expired', color: 'secondary', icon: Clock },
}

export function AgreementSection({ clientId, clientName, hasGhlContactId }: AgreementSectionProps) {
    const [agreements, setAgreements] = useState<Agreement[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSending, setIsSending] = useState(false)
    const [isVoiding, setIsVoiding] = useState(false)
    const [isResending, setIsResending] = useState(false)

    // Void dialog state
    const [voidDialogOpen, setVoidDialogOpen] = useState(false)
    const [voidReason, setVoidReason] = useState('')
    const [agreementToVoid, setAgreementToVoid] = useState<string | null>(null)

    useEffect(() => {
        loadAgreements()
    }, [clientId])

    async function loadAgreements() {
        setIsLoading(true)
        const data = await getClientAgreements(clientId)
        setAgreements(data)
        setIsLoading(false)
    }

    async function handleSendAgreement() {
        if (!hasGhlContactId) {
            toast.error('Client does not have a GHL contact ID. Cannot send agreement.')
            return
        }

        setIsSending(true)
        const result = await sendAgreement(clientId)
        setIsSending(false)

        if (result.success) {
            toast.success('Agreement sent successfully')
            loadAgreements()
        } else {
            toast.error(result.error || 'Failed to send agreement')
        }
    }

    function openVoidDialog(agreementId: string) {
        setAgreementToVoid(agreementId)
        setVoidReason('')
        setVoidDialogOpen(true)
    }

    async function handleVoidAgreement() {
        if (!agreementToVoid || !voidReason.trim()) {
            toast.error('Please provide a reason for voiding')
            return
        }

        setIsVoiding(true)
        const result = await voidAgreement(agreementToVoid, voidReason)
        setIsVoiding(false)

        if (result.success) {
            toast.success('Agreement voided')
            setVoidDialogOpen(false)
            setAgreementToVoid(null)
            loadAgreements()
        } else {
            toast.error(result.error || 'Failed to void agreement')
        }
    }

    async function handleResendAgreement(agreementId: string) {
        setIsResending(true)
        const result = await resendAgreement(agreementId)
        setIsResending(false)

        if (result.success) {
            toast.success('Agreement resent')
            loadAgreements()
        } else {
            toast.error(result.error || 'Failed to resend agreement')
        }
    }

    // Get the active (non-terminal) agreement if any
    const activeAgreement = agreements.find(a => !['signed', 'voided', 'expired'].includes(a.status))
    const signedAgreement = agreements.find(a => a.status === 'signed')
    const canSendNew = !activeAgreement && !signedAgreement

    if (isLoading) {
        return (
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="p-2 rounded-full bg-amber-500/10">
                            <FileText className="h-4 w-4 text-amber-500" />
                        </div>
                        Coaching Agreement
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <div className="p-2 rounded-full bg-amber-500/10">
                                    <FileText className="h-4 w-4 text-amber-500" />
                                </div>
                                Coaching Agreement
                            </CardTitle>
                            <CardDescription>
                                Send and track the coaching agreement for {clientName}
                            </CardDescription>
                        </div>

                        {canSendNew && (
                            <Button
                                onClick={handleSendAgreement}
                                disabled={isSending || !hasGhlContactId}
                            >
                                {isSending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="mr-2 h-4 w-4" />
                                )}
                                Send Agreement
                            </Button>
                        )}
                    </div>
                </CardHeader>

                <CardContent>
                    {!hasGhlContactId && (
                        <div className="mb-4 flex items-center gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                            <AlertCircle className="h-4 w-4" />
                            Client does not have a GHL contact ID. Agreements cannot be sent.
                        </div>
                    )}

                    {agreements.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                            <p>No agreements sent yet</p>
                            {hasGhlContactId && (
                                <p className="text-sm mt-1">Click "Send Agreement" to get started</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {agreements.map((agreement) => {
                                const config = statusConfig[agreement.status]
                                const StatusIcon = config.icon

                                return (
                                    <div
                                        key={agreement.id}
                                        className="flex items-start justify-between rounded-lg border p-4"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={config.color} className="gap-1">
                                                    <StatusIcon className="h-3 w-3" />
                                                    {config.label}
                                                </Badge>
                                                {agreement.template_name && (
                                                    <span className="text-sm text-muted-foreground">
                                                        {agreement.template_name}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-sm text-muted-foreground space-y-0.5">
                                                {agreement.sent_at && (
                                                    <p>Sent: {format(new Date(agreement.sent_at), 'MMM d, yyyy h:mm a')}</p>
                                                )}
                                                {agreement.viewed_at && (
                                                    <p>Viewed: {format(new Date(agreement.viewed_at), 'MMM d, yyyy h:mm a')}</p>
                                                )}
                                                {agreement.signed_at && (
                                                    <p>Signed: {format(new Date(agreement.signed_at), 'MMM d, yyyy h:mm a')}</p>
                                                )}
                                                {agreement.voided_at && (
                                                    <p>Voided: {format(new Date(agreement.voided_at), 'MMM d, yyyy h:mm a')}</p>
                                                )}
                                                {agreement.voided_reason && (
                                                    <p className="text-destructive">Reason: {agreement.voided_reason}</p>
                                                )}
                                                {agreement.sent_by_user?.name && (
                                                    <p>Sent by: {agreement.sent_by_user.name}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* View signed document */}
                                            {agreement.status === 'signed' && agreement.signed_document_url && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <a
                                                        href={agreement.signed_document_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <ExternalLink className="mr-2 h-4 w-4" />
                                                        View Document
                                                    </a>
                                                </Button>
                                            )}

                                            {/* Resend button for sent/viewed agreements */}
                                            {['sent', 'viewed'].includes(agreement.status) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleResendAgreement(agreement.id)}
                                                    disabled={isResending}
                                                >
                                                    {isResending ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="mr-2 h-4 w-4" />
                                                    )}
                                                    Resend
                                                </Button>
                                            )}

                                            {/* Void button for non-terminal agreements */}
                                            {!['signed', 'voided', 'expired'].includes(agreement.status) && (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => openVoidDialog(agreement.id)}
                                                >
                                                    <XCircle className="mr-2 h-4 w-4" />
                                                    Void
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Void Agreement Dialog */}
            <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Void Agreement</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to void this agreement? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="voidReason">Reason for voiding</Label>
                            <Textarea
                                id="voidReason"
                                placeholder="Enter a reason..."
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setVoidDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleVoidAgreement}
                            disabled={isVoiding || !voidReason.trim()}
                        >
                            {isVoiding ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                            )}
                            Void Agreement
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
