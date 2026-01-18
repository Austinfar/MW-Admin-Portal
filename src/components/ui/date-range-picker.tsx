"use client"

import * as React from "react"
import { addDays, format, startOfMonth, endOfMonth, startOfYear, subDays, subMonths } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
    date: DateRange | undefined
    setDate: (date: DateRange | undefined) => void
    className?: string
    presets?: { label: string; date: DateRange }[]
}

export function DateRangePicker({
    date,
    setDate,
    className,
    presets = []
}: DateRangePickerProps) {
    const [open, setOpen] = React.useState(false)

    // Add default presets
    const defaultPresets = [
        {
            label: 'Today',
            date: { from: new Date(), to: new Date() }
        },
        {
            label: 'Yesterday',
            date: { from: subDays(new Date(), 1), to: subDays(new Date(), 1) }
        },
        {
            label: 'Last 7 Days',
            date: { from: subDays(new Date(), 6), to: new Date() }
        },
        {
            label: 'Last 30 Days',
            date: { from: subDays(new Date(), 29), to: new Date() }
        },
        {
            label: 'This Month',
            date: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) }
        },
        {
            label: 'Last Month',
            date: {
                from: startOfMonth(subMonths(new Date(), 1)),
                to: endOfMonth(subMonths(new Date(), 1))
            }
        },
        {
            label: 'This Year',
            date: { from: startOfYear(new Date()), to: new Date() }
        }
    ];

    const allPresets = [...defaultPresets, ...presets];

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[260px] justify-start text-left font-normal bg-white/5 border-white/10 hover:bg-white/10",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <div className="flex">
                        <div className="border-r border-border p-2 w-[160px] flex flex-col gap-1">
                            {allPresets.map((preset, i) => (
                                <Button
                                    key={preset.label + i}
                                    variant="ghost"
                                    size="sm"
                                    className="justify-start font-normal text-xs h-8"
                                    onClick={() => {
                                        setDate(preset.date);
                                        // Keep open effectively to see change? Or close? Standard is keep open or close.
                                        // Let's close for presets as it's a "shortcut"
                                        // Actually, standard usually keeps open until user clicks outside/applies.
                                        // But for shortcuts, immediate action feels snappier.
                                        // However, if we want to confirm, we should keep open. 
                                        // Let's force update and keep open so they can see the range
                                    }}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>
                        <div className="p-2">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={2}
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
