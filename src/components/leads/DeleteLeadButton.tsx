'use client'

import { Button } from '@/components/ui/button'
import { Trash } from 'lucide-react'
import { deleteLead } from '@/lib/actions/lead-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function DeleteLeadButton({ id }: { id: string }) {
    const router = useRouter()

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this lead? This cannot be undone.')) return

        toast.promise(async () => {
            await deleteLead(id)
            router.push('/leads')
        }, {
            loading: 'Deleting...',
            success: 'Lead deleted',
            error: 'Failed to delete'
        })
    }

    return (
        <Button variant="destructive" onClick={handleDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
        </Button>
    )
}
