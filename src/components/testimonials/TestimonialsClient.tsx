'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, Camera, Star, Video } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface Testimonial {
    id: string
    name: string
    role: string
    image: string
    video_url?: string
    video_thumbnail?: string
    rating: number
    short_quote: string
    full_story: string
    stats: { label: string; value: string }[]
    category: 'male' | 'female'
    display_order: number
    is_active: boolean
}

export default function TestimonialsClient() {
    const supabase = createClient()

    const [testimonials, setTestimonials] = useState<Testimonial[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'male' | 'female'>('male')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Testimonial | null>(null)

    // Form State
    const [formData, setFormData] = useState<Partial<Testimonial>>({
        name: '',
        role: '',
        image: '',
        video_url: '',
        video_thumbnail: '',
        rating: 5,
        short_quote: '',
        full_story: '',
        stats: [],
        category: 'male',
        display_order: 0,
    })

    // Local state for stats editing
    const [statsInput, setStatsInput] = useState<{ label: string; value: string }[]>([])

    useEffect(() => {
        fetchTestimonials()
    }, [activeTab])

    const fetchTestimonials = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('testimonials')
            .select('*')
            .order('display_order', { ascending: true })

        if (error) {
            console.error('Error fetching testimonials:', error)
        } else {
            setTestimonials(data || [])
        }
        setLoading(false)
    }

    const filteredTestimonials = testimonials.filter(t => t.category === activeTab)

    const handleOpenModal = (item?: Testimonial) => {
        if (item) {
            setEditingItem(item)
            setFormData({
                name: item.name,
                role: item.role,
                image: item.image,
                video_url: item.video_url,
                video_thumbnail: item.video_thumbnail,
                rating: item.rating,
                short_quote: item.short_quote,
                full_story: item.full_story,
                category: item.category,
                display_order: item.display_order,
            })
            setStatsInput(item.stats || [])
        } else {
            setEditingItem(null)
            setFormData({
                name: '',
                role: '',
                image: '',
                video_url: '',
                video_thumbnail: '',
                rating: 5,
                short_quote: '',
                full_story: '',
                category: activeTab,
                display_order: (filteredTestimonials.length + 1) * 10,
            })
            setStatsInput([{ label: '', value: '' }, { label: '', value: '' }]) // Start with 2 empty slots
        }
        setIsModalOpen(true)
    }

    const handleStatChange = (index: number, field: 'label' | 'value', value: string) => {
        const newStats = [...statsInput]
        newStats[index][field] = value
        setStatsInput(newStats)
    }

    const addStatRow = () => {
        setStatsInput([...statsInput, { label: '', value: '' }])
    }

    const removeStatRow = (index: number) => {
        const newStats = statsInput.filter((_, i) => i !== index)
        setStatsInput(newStats)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const finalStats = statsInput.filter(s => s.label.trim() !== '' || s.value.trim() !== '')

        const payload = {
            ...formData,
            stats: finalStats,
        }

        try {
            if (editingItem) {
                const { error } = await supabase
                    .from('testimonials')
                    .update(payload)
                    .eq('id', editingItem.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('testimonials')
                    .insert([payload])

                if (error) throw error
            }

            fetchTestimonials()
            setIsModalOpen(false)
        } catch (error: any) {
            console.error('Error saving testimonial:', error)
            alert(`Error saving: ${error.message || JSON.stringify(error)}`)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this testimonial?')) return

        try {
            const { error } = await supabase
                .from('testimonials')
                .delete()
                .eq('id', id)

            if (error) throw error
            fetchTestimonials()
        } catch (error) {
            console.error('Error deleting testimonial:', error)
        }
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Testimonials</h1>
                    <p className="text-muted-foreground mt-2">Manage success stories, quotes, and video testimonials.</p>
                </div>
                <Button
                    onClick={() => handleOpenModal()}
                    className="bg-primary text-black hover:bg-primary/90 font-semibold"
                >
                    <Plus className="w-4 h-4 mr-2" /> Add Testimonial
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'male' | 'female')} className="w-full">
                <TabsList className="bg-zinc-900 border border-white/10 p-1">
                    <TabsTrigger value="male" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Male Testimonials</TabsTrigger>
                    <TabsTrigger value="female" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Female Testimonials</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">Loading...</div>
                    ) : filteredTestimonials.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/50">
                            <Camera className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
                            <h3 className="text-lg font-medium text-white">No testimonials found</h3>
                            <p className="text-zinc-500 mb-6">Get started by adding your first testimonial.</p>
                            <Button onClick={() => handleOpenModal()} variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                                Create Testimonial
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTestimonials.map((item) => (
                                <Card key={item.id} className="bg-zinc-900 border-zinc-800 overflow-hidden group flex flex-col">
                                    <div className="aspect-video relative bg-zinc-800">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="absolute inset-0 w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                                                <Camera className="w-8 h-8" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                                            {item.video_url && (
                                                <div className="bg-red-600 text-white px-2 py-1 rounded backdrop-blur-md shadow-sm flex items-center gap-1.5 text-xs font-bold uppercase">
                                                    <Video className="w-3 h-3" /> Video
                                                </div>
                                            )}
                                            <div className="bg-black/60 text-white px-2 py-1 rounded backdrop-blur-md text-xs font-mono ml-auto">
                                                Order: {item.display_order}
                                            </div>
                                        </div>
                                    </div>
                                    <CardContent className="p-5 flex flex-col flex-1">
                                        <div className="mb-4">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-white text-lg">{item.name}</h3>
                                                <div className="flex text-amber-500">
                                                    {[...Array(item.rating || 5)].map((_, i) => (
                                                        <Star key={i} className="w-3 h-3 fill-current" />
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="text-sm text-primary font-medium">{item.role}</p>
                                        </div>

                                        <p className="text-zinc-400 text-sm line-clamp-3 italic mb-4 flex-1">"{item.short_quote}"</p>

                                        <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-zinc-800">
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
                <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Testimonial' : 'New Testimonial'}</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {editingItem ? 'Update details below.' : 'Add a new success story.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6 mt-4">

                        {/* Basic Info */}
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Client Name</Label>
                                <Input
                                    className="bg-zinc-900 border-zinc-800"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Evan Hendrickson"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Role / Title</Label>
                                <Input
                                    className="bg-zinc-900 border-zinc-800"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    placeholder="e.g. Men's Physique Competitor"
                                />
                            </div>
                        </div>

                        {/* Media */}
                        <div className="space-y-4 border-t border-zinc-800 pt-4">
                            <h4 className="font-semibold text-sm text-zinc-400 uppercase tracking-wider">Media</h4>
                            <div className="space-y-2">
                                <Label>Image URL (Required, displayed in grid)</Label>
                                <Input
                                    className="bg-zinc-900 border-zinc-800"
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                    placeholder="https://..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Video URL (Optional)</Label>
                                    <Input
                                        className="bg-zinc-900 border-zinc-800"
                                        value={formData.video_url}
                                        onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Video Thumbnail URL (Optional)</Label>
                                    <Input
                                        className="bg-zinc-900 border-zinc-800"
                                        value={formData.video_thumbnail}
                                        onChange={(e) => setFormData({ ...formData, video_thumbnail: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-4 border-t border-zinc-800 pt-4">
                            <h4 className="font-semibold text-sm text-zinc-400 uppercase tracking-wider">Story Content</h4>
                            <div className="space-y-2">
                                <Label>Short Quote (Card View)</Label>
                                <Textarea
                                    className="bg-zinc-900 border-zinc-800 min-h-[60px]"
                                    value={formData.short_quote}
                                    onChange={(e) => setFormData({ ...formData, short_quote: e.target.value })}
                                    placeholder='"It changed my life..."'
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Full Story (Modal View)</Label>
                                <Textarea
                                    className="bg-zinc-900 border-zinc-800 min-h-[120px]"
                                    value={formData.full_story}
                                    onChange={(e) => setFormData({ ...formData, full_story: e.target.value })}
                                    placeholder="Tell the full transformation story..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Rating (1-5)</Label>
                                <Select
                                    value={formData.rating?.toString()}
                                    onValueChange={(v) => setFormData({ ...formData, rating: parseInt(v) })}
                                >
                                    <SelectTrigger className="bg-zinc-900 border-zinc-800 w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                        {[1, 2, 3, 4, 5].map(r => (
                                            <SelectItem key={r} value={r.toString()}>{r} Stars</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="space-y-4 border-t border-zinc-800 pt-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-semibold text-sm text-zinc-400 uppercase tracking-wider">Key Stats</h4>
                                <Button type="button" variant="outline" size="sm" onClick={addStatRow} className="border-zinc-800 h-7 text-xs">
                                    + Add Stat
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {statsInput.map((stat, idx) => (
                                    <div key={idx} className="flex gap-3 items-end">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs text-zinc-500">Label</Label>
                                            <Input
                                                className="bg-zinc-900 border-zinc-800 h-9"
                                                value={stat.label}
                                                onChange={(e) => handleStatChange(idx, 'label', e.target.value)}
                                                placeholder="e.g. Lost"
                                            />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-xs text-zinc-500">Value</Label>
                                            <Input
                                                className="bg-zinc-900 border-zinc-800 h-9"
                                                value={stat.value}
                                                onChange={(e) => handleStatChange(idx, 'value', e.target.value)}
                                                placeholder="e.g. 50 lbs"
                                            />
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeStatRow(idx)} className="h-9 w-9 text-zinc-500 hover:text-red-400">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="mt-8 pt-4 border-t border-zinc-800">
                            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-primary text-black hover:bg-primary/90">Save Testimonial</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
