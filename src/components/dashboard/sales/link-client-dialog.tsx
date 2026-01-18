'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { getClients } from '@/lib/actions/clients'
import { Client } from '@/types/client'
import { linkClientToLog } from '@/lib/actions/sales'
import { toast } from 'sonner'

interface LinkClientDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    logId: string
    currentClientId?: string | null
    currentClientName?: string
    onSuccess?: () => void
}

export function LinkClientDialog({
    open,
    onOpenChange,
    logId,
    currentClientId,
    currentClientName,
    onSuccess
}: LinkClientDialogProps) {
    const [clients, setClients] = React.useState<Client[]>([])
    const [loading, setLoading] = React.useState(false)
    const [saving, setSaving] = React.useState(false)
    const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null)
    const [openCombobox, setOpenCombobox] = React.useState(false)
    const [isRelinking, setIsRelinking] = React.useState(false)

    React.useEffect(() => {
        if (open) {
            setLoading(true)
            // If we have a current client, we start in "View" mode (isRelinking = false)
            // If no current client, we start in "Link" mode (effectively isRelinking = true logic)
            setIsRelinking(!currentClientId)

            // Allow user to select a different client immediately if they want, but don't set it yet
            setSelectedClientId(null)

            getClients()
                .then((data) => {
                    setClients(data)
                })
                .catch((err) => {
                    console.error('Failed to load clients', err)
                    toast.error('Failed to load clients')
                })
                .finally(() => setLoading(false))
        }
    }, [open, currentClientId])

    const handleSave = async () => {
        if (!selectedClientId) return

        setSaving(true)
        try {
            const result = await linkClientToLog(logId, selectedClientId)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Client linked successfully')
                onOpenChange(false)
                onSuccess?.()
            }
        } catch (error) {
            toast.error('An unexpected error occurred')
        } finally {
            setSaving(false)
        }
    }

    const selectedClient = clients.find(c => c.id === selectedClientId)

    const showLinkInterface = !currentClientId || isRelinking

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{currentClientId && !isRelinking ? 'Linked Client' : 'Link Client'}</DialogTitle>
                    <DialogDescription>
                        {currentClientId && !isRelinking
                            ? 'This analysis is currently linked to a client.'
                            : 'Search for a client to link to this sales call analysis.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {!showLinkInterface ? (
                        <div className="flex flex-col gap-4">
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-md flex items-center justify-between">
                                <span className="font-medium text-emerald-500 flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    {'Currently linked to '}
                                    <span className="font-bold ml-1">{currentClientName || 'Unknown Client'}</span>
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setIsRelinking(true)}
                            >
                                Relink to different client
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading clients...
                                            </span>
                                        ) : selectedClient ? (
                                            selectedClient.name
                                        ) : (
                                            "Select client..."
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search client..." />
                                        <CommandList>
                                            <CommandEmpty>No client found.</CommandEmpty>
                                            <CommandGroup>
                                                {clients.map((client) => (
                                                    <CommandItem
                                                        key={client.id}
                                                        value={client.name}
                                                        onSelect={() => {
                                                            setSelectedClientId(client.id)
                                                            setOpenCombobox(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {client.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {currentClientId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsRelinking(false)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {showLinkInterface && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!selectedClientId || saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Link
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
