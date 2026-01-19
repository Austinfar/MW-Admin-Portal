'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { convertLeadToClient } from '@/lib/actions/lead-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function ConvertLeadButton({ id }: { id: string }) {
    const router = useRouter()

    const handleConvert = async () => {
        toast.promise(async () => {
            const result = await convertLeadToClient(id)
            if (result?.error) throw new Error(result.error)
            router.push('/clients') // Redirect to clients list
        }, {
            loading: 'Converting to client...',
            success: 'Lead converted successfully!',
            error: (err) => `Failed to convert: ${err}`
        })
    }

    return (
        <Button onClick={handleConvert} className="bg-neon-green text-black hover:bg-neon-green/90">
            <ArrowRight className="mr-2 h-4 w-4" />
            Convert to Client
        </Button>
    )
}
