'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Calendar as CalendarIcon, User, Clock } from 'lucide-react';
import { getSalesBookings } from '@/lib/actions/cal';
import { CalBooking } from '@/lib/cal/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Setup localizer
const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const EventComponent = ({ event }: { event: any }) => {
    const booking = event.resource as CalBooking;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACCEPTED':
            case 'PENDING':
                return 'bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-100';
            case 'CANCELLED':
            case 'REJECTED':
                return 'bg-red-500/10 border-l-2 border-red-500 text-red-300 opacity-60';
            default:
                return 'bg-blue-500/10 border-l-2 border-blue-500 text-blue-100';
        }
    }

    return (
        <div className={cn(
            "h-full w-full flex flex-col justify-center px-2 py-0.5 text-xs overflow-hidden rounded-md transition-all hover:bg-white/5",
            getStatusColor(booking.status)
        )}>
            <div className="font-semibold truncate">{event.title}</div>
            <div className="flex items-center gap-1.5 opacity-70 truncate mt-0.5 text-[10px] uppercase tracking-wide">
                <User className="w-2.5 h-2.5" />
                {booking.attendees[0]?.name || 'Unknown'}
            </div>
        </div>
    );
};

export default function SalesCalendar() {
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState<View>(Views.MONTH);
    const [bookings, setBookings] = useState<CalBooking[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMember, setSelectedMember] = useState<string>('all');
    const [selectedEvent, setSelectedEvent] = useState<CalBooking | null>(null);

    // Filter attendees/team members
    const teamMembers = useMemo(() => {
        const members = new Set<string>();
        bookings.forEach(b => {
            if (b.user?.name) members.add(b.user.name);
        });
        return Array.from(members).sort();
    }, [bookings]);

    const fetchBookings = async () => {
        setLoading(true);
        // Fetch for a wide range (e.g., current month +/- 1 month)
        // ideally RBG's onRangeChange is better but simple full fetch is safer for small data
        const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 2, 0);

        const { bookings: data, error } = await getSalesBookings(start, end);
        if (data) setBookings(data);
        if (error) console.error(error);
        setLoading(false);
    };

    useEffect(() => {
        fetchBookings();
    }, [date]); // Re-fetch on major date changes if needed, but for now we just load once on mount effectively if we don't change 'date' state drastically

    // Convert bookings to events
    const events = useMemo(() => {
        return bookings
            .filter(b => selectedMember === 'all' || b.user?.name === selectedMember)
            .map(b => ({
                id: b.id,
                title: b.title,
                start: new Date(b.startTime),
                end: new Date(b.endTime),
                resource: b,
            }));
    }, [bookings, selectedMember]);

    // Custom coloring based on booking status
    const eventPropGetter = (event: any) => {
        return { style: { backgroundColor: 'transparent' } }; // Fully handle styling in component
    };

    return (
        <div className="h-full space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <CalendarIcon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white">Sales Calendar</h2>
                        <p className="text-xs text-muted-foreground">Manage consultations & demos</p>
                    </div>
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-2" />}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger className="w-[200px] bg-zinc-900/40 border-white/5 backdrop-blur-xl text-sm h-9">
                            <SelectValue placeholder="Filter by Team Member" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/10 text-white">
                            <SelectItem value="all">All Team Members</SelectItem>
                            {teamMembers.map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={fetchBookings}
                        className="bg-zinc-900/40 border-white/5 hover:bg-white/10 hover:text-white h-9 w-9"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <Card className="flex-1 min-h-[600px] border-white/5 bg-zinc-900/40 backdrop-blur-xl shadow-2xl overflow-hidden">
                <CardContent className="p-6 h-[750px] calendar-container">
                    <Calendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: '100%' }}
                        date={date}
                        onNavigate={setDate}
                        view={view}
                        onView={setView}
                        components={{
                            event: EventComponent
                        }}
                        eventPropGetter={eventPropGetter}
                        onSelectEvent={(event) => setSelectedEvent(event.resource)}
                        className="rounded-xl text-sm"
                    />
                </CardContent>
            </Card>

            {/* Event Details Modal */}
            <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
                <DialogContent className="sm:max-w-[425px] bg-zinc-950/90 backdrop-blur-2xl border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg">
                            {selectedEvent?.title}
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-xs px-2 py-0.5 border-none",
                                    selectedEvent?.status === 'ACCEPTED' && 'bg-green-500/20 text-green-400',
                                    selectedEvent?.status === 'PENDING' && 'bg-yellow-500/20 text-yellow-400',
                                    selectedEvent?.status === 'IN_PROGRESS' && 'bg-blue-500/20 text-blue-400',
                                    selectedEvent?.status === 'COMPLETED' && 'bg-zinc-500/20 text-zinc-400',
                                    selectedEvent?.status === 'CANCELLED' && 'bg-red-500/20 text-red-400',
                                    selectedEvent?.status === 'HOST_NO_SHOW' && 'bg-orange-500/20 text-orange-400',
                                    selectedEvent?.status === 'GUEST_NO_SHOW' && 'bg-pink-500/20 text-pink-400'
                                )}
                            >
                                {selectedEvent?.status?.replace(/_/g, ' ')}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {selectedEvent && format(new Date(selectedEvent.startTime), 'EEEE, MMMM d, yyyy')}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEvent && (
                        <div className="grid gap-5 py-4">
                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                                <Clock className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm font-medium">
                                    {format(new Date(selectedEvent.startTime), 'h:mm a')} - {format(new Date(selectedEvent.endTime), 'h:mm a')}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Attendees</div>
                                <div className="space-y-2">
                                    {selectedEvent.attendees.map((att, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-400 border border-emerald-500/20">
                                                {att.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">{att.name}</div>
                                                <div className="text-xs text-zinc-500">{att.email}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedEvent.description && (
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <div className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Notes</div>
                                    <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                        {selectedEvent.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
