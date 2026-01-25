'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, Camera, Trophy, Sparkles } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
// import { useToast } from 'sonner' 

interface Transformation {
    id: string
    name: string
    image: string
    type: 'Lifestyle' | 'Competition'
    category: 'male' | 'female'
    display_order: number
    is_active: boolean
}

export default function TransformationsClient() {
    const supabase = createClient()
    // const { toast } = useToast()

    const [transformations, setTransformations] = useState<Transformation[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'male' | 'female'>('male')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Transformation | null>(null)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        image: '',
        type: 'Lifestyle' as 'Lifestyle' | 'Competition',
        category: 'male' as 'male' | 'female',
        display_order: 0,
    })

    useEffect(() => {
        fetchTransformations()
    }, [activeTab]) // Refetch when tab changes or just filter local state? Better to filter local state to save reads, but simple fetch for now.

    const fetchTransformations = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('transformations')
            .select('*')
            .order('display_order', { ascending: true })

        if (error) {
            console.error('Error fetching transformations:', error)
            // toast.error('Failed to load transformations')
        } else {
            setTransformations(data || [])
        }
        setLoading(false)
    }

    const filteredTransformations = transformations.filter(t => t.category === activeTab)

    const handleOpenModal = (item?: Transformation) => {
        if (item) {
            setEditingItem(item)
            setFormData({
                name: item.name,
                image: item.image,
                type: item.type,
                category: item.category,
                display_order: item.display_order,
            })
        } else {
            setEditingItem(null)
            setFormData({
                name: '',
                image: '',
                type: 'Lifestyle',
                category: activeTab, // Default to current tab
                display_order: (filteredTransformations.length + 1) * 10, // Auto-increment by 10
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            if (editingItem) {
                const { error } = await supabase
                    .from('transformations')
                    .update(formData)
                    .eq('id', editingItem.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('transformations')
                    .insert([formData])

                if (error) throw error
            }

            fetchTransformations()
            setIsModalOpen(false)
        } catch (error: any) {
            console.error('Error saving transformation:', error)
            alert(`Error saving: ${error.message || JSON.stringify(error)}`)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transformation?')) return

        try {
            const { error } = await supabase
                .from('transformations')
                .delete()
                .eq('id', id)

            if (error) throw error
            fetchTransformations()
        } catch (error) {
            console.error('Error deleting transformation:', error)
        }
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Transformations Gallery</h1>
                    <p className="text-muted-foreground mt-2">Manage before/after photos displayed on the landing pages.</p>
                </div>
                <Button
                    onClick={() => handleOpenModal()}
                    className="bg-primary text-black hover:bg-primary/90 font-semibold"
                >
                    <Plus className="w-4 h-4 mr-2" /> Add Transformation
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'male' | 'female')} className="w-full">
                <TabsList className="bg-zinc-900 border border-white/10 p-1">
                    <TabsTrigger value="male" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Male Transformations</TabsTrigger>
                    <TabsTrigger value="female" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Female Transformations</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">Loading...</div>
                    ) : filteredTransformations.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/50">
                            <Camera className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
                            <h3 className="text-lg font-medium text-white">No transformations found</h3>
                            <p className="text-zinc-500 mb-6">Get started by adding your first transformation.</p>
                            <Button onClick={() => handleOpenModal()} variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                                Create Transformation
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {filteredTransformations.map((item) => (
                                <Card key={item.id} className="bg-zinc-900 border-zinc-800 overflow-hidden group">
                                    <div className="aspect-[4/5] relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                                            <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase backdrop-blur-md shadow-sm ${item.type === 'Competition' ? 'bg-amber-500 text-black' : 'bg-green-500 text-black'}`}>
                                                {item.type}
                                            </div>
                                            <div className="bg-black/60 text-white px-2 py-1 rounded backdrop-blur-md text-xs font-mono">
                                                Order: {item.display_order}
                                            </div>
                                        </div>
                                    </div>
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-white text-lg">{item.name}</h3>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-zinc-800">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full border-zinc-700 hover:bg-zinc-800 text-white"
                                                onClick={() => handleOpenModal(item)}
                                            >
                                                <Pencil className="w-3 h-3 mr-2" /> Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="w-full bg-red-900/20 text-red-400 hover:bg-red-900/40 border-red-900/50"
                                                onClick={() => handleDelete(item.id)}
                                            >
                                                <Trash2 className="w-3 h-3 mr-2" /> Delete
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Editor Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Transformation' : 'New Transformation'}</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {editingItem ? 'Update details below.' : 'Add a new client transformation story.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v: 'male' | 'female') => setFormData({ ...formData, category: v })}
                                >
                                    <SelectTrigger className="bg-zinc-900 border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Display Order</Label>
                                <Input
                                    type="number"
                                    className="bg-zinc-900 border-zinc-800"
                                    value={formData.display_order}
                                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Client Name</Label>
                            <Input
                                className="bg-zinc-900 border-zinc-800"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Image URL (After Photo)</Label>
                            <Input
                                className="bg-zinc-900 border-zinc-800"
                                value={formData.image}
                                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(v: 'Lifestyle' | 'Competition') => setFormData({ ...formData, type: v })}
                            >
                                <SelectTrigger className="bg-zinc-900 border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                    <SelectItem value="Lifestyle">Lifestyle</SelectItem>
                                    <SelectItem value="Competition">Competition</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter className="mt-6">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-primary text-black hover:bg-primary/90">Save Transformation</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
