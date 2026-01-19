'use client'

import { useState } from 'react'
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createLead } from '@/lib/actions/lead-actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function AddLeadDialog() {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsLoading(true)

        const formData = new FormData(event.currentTarget)
        const result = await createLead(formData)

        if (result?.error) {
            toast.error(result.error)
        } else {
            toast.success('Lead created successfully')
            setOpen(false)
            router.refresh()
        }
        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-neon-green text-black hover:bg-neon-green/90">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lead
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Enter the details of the new lead.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First name</Label>
                                <Input id="firstName" name="firstName" required className="bg-zinc-800 border-zinc-700" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last name</Label>
                                <Input id="lastName" name="lastName" className="bg-zinc-800 border-zinc-700" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" className="bg-zinc-800 border-zinc-700" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" name="phone" type="tel" className="bg-zinc-800 border-zinc-700" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading} className="bg-neon-green text-black hover:bg-neon-green/90">
                            {isLoading ? 'Saving...' : 'Save Lead'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
