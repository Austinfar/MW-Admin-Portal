'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sword, Calculator, Copy, ExternalLink, Zap } from 'lucide-react'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

export function WarRoom() {
    const [calcAmount, setCalcAmount] = useState('')
    const [commission, setCommission] = useState<{ rep: number, setter: number } | null>(null)

    const handleCalculate = () => {
        const amount = parseFloat(calcAmount)
        if (isNaN(amount)) return

        // Simple logic: 10% Rep, 5% Setter (Example)
        setCommission({
            rep: amount * 0.10,
            setter: amount * 0.05
        })
    }

    const copyLink = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Link copied to clipboard!")
    }

    return (
        <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/5 h-full shadow-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center">
                    <Sword className="w-4 h-4 mr-2" />
                    War Room
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
                <Button
                    variant="outline"
                    className="w-full justify-start text-left bg-white/5 border-white/5 hover:bg-white/10 hover:text-white transition-all duration-300"
                    onClick={() => copyLink("https://mwfitnesscoaching.com/book")}
                >
                    <Copy className="w-3.5 h-3.5 mr-2 text-blue-400" />
                    Copy Booking Link
                </Button>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-start text-left bg-white/5 border-white/5 hover:bg-white/10 hover:text-white transition-all duration-300"
                        >
                            <Calculator className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                            Commission Calc
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-950/90 backdrop-blur-xl border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>Quick Commission Calculator</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Deal Size ($)</Label>
                                <Input
                                    type="number"
                                    placeholder="3000"
                                    value={calcAmount}
                                    onChange={(e) => setCalcAmount(e.target.value)}
                                    className="bg-[#121212] border-gray-700"
                                />
                            </div>
                            <Button onClick={handleCalculate} className="w-full bg-emerald-600 hover:bg-emerald-700">Calculate</Button>

                            {commission && (
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800 mt-4">
                                    <div className="text-center p-3 bg-emerald-500/10 rounded-lg">
                                        <div className="text-xs text-gray-400">Rep (10%)</div>
                                        <div className="text-xl font-bold text-emerald-400">${commission.rep.toFixed(0)}</div>
                                    </div>
                                    <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                                        <div className="text-xs text-gray-400">Setter (5%)</div>
                                        <div className="text-xl font-bold text-blue-400">${commission.setter.toFixed(0)}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <Button
                    variant="ghost"
                    className="w-full justify-start text-left text-xs text-gray-500 hover:text-white h-auto py-2"
                >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    Open Script Library
                </Button>
            </CardContent>
        </Card>
    )
}
