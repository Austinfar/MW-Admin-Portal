'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Check, Clipboard, RefreshCw, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function LinkGeneratorPage() {
    // --- State ---
    const [funnel, setFunnel] = useState<string>('she')
    const [leadType, setLeadType] = useState<string>('company')
    const [coach, setCoach] = useState<string>('none')
    const [trafficType, setTrafficType] = useState<string>('paid')
    const [source, setSource] = useState<string>('instagram')

    // Manual overrides
    const [campaign, setCampaign] = useState<string>('')
    const [term, setTerm] = useState<string>('')
    const [content, setContent] = useState<string>('')

    // Result
    const [generatedUrl, setGeneratedUrl] = useState<string>('')

    // --- Constants ---
    const BASE_URLS: Record<string, string> = {
        'she': 'https://she.mwfitnesscoaching.com/',
        'him': 'https://him.mwfitnesscoaching.com/',
        'book': 'https://book.mwfitnesscoaching.com/'
    }

    const COACHES = [
        { label: 'No Specific Coach', value: 'none' },
        { label: 'Matt Basardo', value: 'matt-basardo' },
        { label: 'Sarah Gleason', value: 'sarah-gleason' }
    ]

    const SOURCES = [
        { label: 'Instagram', value: 'instagram' },
        { label: 'Facebook', value: 'facebook' },
        { label: 'TikTok', value: 'tiktok' },
        { label: 'Email', value: 'email' },
        { label: 'SMS', value: 'sms' },
        { label: 'Google Ads', value: 'google_ads' },
        { label: 'Other', value: 'other' }
    ]

    // --- Logic ---
    useEffect(() => {
        let url = new URL(BASE_URLS[funnel])
        const params = new URLSearchParams()

        // 1. Attribution
        if (leadType === 'coach' && coach !== 'none') {
            params.set('lead_type', 'coach')
            params.set('coach', coach)
        } else {
            params.set('lead_type', 'company')
            if (coach !== 'none') {
                // Even if company lead, we might want to pre-select a coach? 
                // Usually for company leads we don't. But let's support it if selected.
                params.set('coach', coach)
            }
        }

        // 2. UTMs
        params.set('utm_source', source)

        if (trafficType === 'paid') {
            params.set('utm_medium', 'paid')
            // Auto template for Meta
            if (['facebook', 'instagram', 'tiktok'].includes(source)) {
                params.set('utm_campaign', campaign || '{{campaign.name}}')
                params.set('utm_content', content || '{{ad.name}}')
                params.set('utm_term', term || '{{adset.name}}')
            } else {
                if (campaign) params.set('utm_campaign', campaign)
                if (content) params.set('utm_content', content)
                if (term) params.set('utm_term', term)
            }
        } else {
            params.set('utm_medium', 'organic')
            // For organic, we usually don't need campaign placeholders unless user types specific ones
            if (campaign) params.set('utm_campaign', campaign)
            if (content) params.set('utm_content', content)
            if (term) params.set('utm_term', term)
        }

        url.search = params.toString()
        setGeneratedUrl(url.toString())

    }, [funnel, leadType, coach, trafficType, source, campaign, term, content])

    // --- Handlers ---
    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedUrl)
        toast.success('Link copied to clipboard')
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Marketing Link Generator</h1>
                <p className="text-muted-foreground mt-2">
                    Create tracking URLs for Ads, Social Profiles, and Email Campaigns.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Configuration Panel */}
                <Card className="border-white/5 bg-zinc-900/50 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 text-indigo-400" />
                            Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* 1. Funnel Selection */}
                        <div className="space-y-3">
                            <Label>Funnel Endpoint</Label>
                            <Select value={funnel} onValueChange={setFunnel}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Funnel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="she">Women's Application (she.mwfitness...)</SelectItem>
                                    <SelectItem value="him">Men's Application (him.mwfitness...)</SelectItem>
                                    <SelectItem value="book">Direct Booking (book.mwfitness...)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 2. Attribution */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <Label>Lead Attribution</Label>
                                <RadioGroup value={leadType} onValueChange={setLeadType} className="flex flex-col gap-2">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="company" id="r-company" />
                                        <Label htmlFor="r-company" className="font-normal cursor-pointer">Company Lead</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="coach" id="r-coach" />
                                        <Label htmlFor="r-coach" className="font-normal cursor-pointer">Coach Driven</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="space-y-3">
                                <Label>Assign Coach</Label>
                                <Select value={coach} onValueChange={setCoach}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Coach" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COACHES.map(c => (
                                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="h-px bg-white/10" />

                        {/* 3. Traffic Source */}
                        <div className="space-y-3">
                            <Label>Traffic Type</Label>
                            <RadioGroup value={trafficType} onValueChange={setTrafficType} className="grid grid-cols-2 gap-4">
                                <div className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${trafficType === 'paid' ? 'bg-indigo-500/10 border-indigo-500/50' : 'border-white/10'}`}>
                                    <RadioGroupItem value="paid" id="t-paid" />
                                    <Label htmlFor="t-paid" className="cursor-pointer font-medium">Paid Advertisement</Label>
                                </div>
                                <div className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${trafficType === 'organic' ? 'bg-green-500/10 border-green-500/50' : 'border-white/10'}`}>
                                    <RadioGroupItem value="organic" id="t-organic" />
                                    <Label htmlFor="t-organic" className="cursor-pointer font-medium">Organic / Manual</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-3">
                            <Label>Source Platform</Label>
                            <Select value={source} onValueChange={setSource}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SOURCES.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                    </CardContent>
                </Card>


                {/* Output Panel */}
                <div className="space-y-6">
                    <Card className="border-indigo-500/30 bg-indigo-950/20 shadow-[0_0_50px_rgba(79,70,229,0.1)]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-indigo-400">
                                <LinkIcon className="w-5 h-5" />
                                Generated URL
                            </CardTitle>
                            <CardDescription>
                                {trafficType === 'paid' && (
                                    <span className="text-yellow-400/80 flex items-center gap-1.5 text-xs bg-yellow-400/10 px-2 py-1 rounded w-fit">
                                        ⚠️ Contains Ad Variables ({`{{...}}`}) - Do not use for testing
                                    </span>
                                )}
                            </CardDescription>

                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <textarea
                                    readOnly
                                    value={generatedUrl}
                                    className="w-full h-32 p-4 bg-black/50 border border-indigo-500/30 rounded-lg font-mono text-sm text-indigo-200 focus:outline-none resize-none"
                                />
                                <Button
                                    size="sm"
                                    onClick={copyToClipboard}
                                    className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-indigo-500 text-white"
                                >
                                    <Clipboard className="w-4 h-4 mr-2" />
                                    Copy Link
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Advanced Params (Only show if needed) */}
                    <Card className="border-white/5 bg-zinc-900/30">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Advanced Overrides</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs">Campaign Name</Label>
                                    <Input
                                        placeholder={trafficType === 'paid' ? '{{campaign.name}}' : 'january_promo'}
                                        value={campaign}
                                        onChange={e => setCampaign(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Content / Ad Name</Label>
                                    <Input
                                        placeholder={trafficType === 'paid' ? '{{ad.name}}' : 'video_v1'}
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    )
}
