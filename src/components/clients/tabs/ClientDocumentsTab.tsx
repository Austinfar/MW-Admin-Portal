'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ClientDocuments } from '@/components/clients/ClientDocuments'
import { AgreementSection } from '@/components/clients/AgreementSection'
import { ClientDocument } from '@/types/client'

interface ClientDocumentsTabProps {
    clientId: string
    clientName: string
    documents: ClientDocument[]
    hasGhlContactId: boolean
}

export function ClientDocumentsTab({ clientId, clientName, documents, hasGhlContactId }: ClientDocumentsTabProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Documents */}
            <Card className="bg-card/50 backdrop-blur-xl border-white/5 hover:border-primary/20 transition-all duration-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <CardHeader>
                    <CardTitle>Documents</CardTitle>
                    <CardDescription>Files and resources for this client</CardDescription>
                </CardHeader>
                <CardContent>
                    <ClientDocuments clientId={clientId} documents={documents} />
                </CardContent>
            </Card>

            {/* Right Column: Agreement */}
            <AgreementSection
                clientId={clientId}
                clientName={clientName}
                hasGhlContactId={hasGhlContactId}
            />
        </div>
    )
}
