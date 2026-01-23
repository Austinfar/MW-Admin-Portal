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

// Custom Event Component
const EventComponent = ({ event }: { event: any }) => {
    const booking = event.resource as CalBooking;

    // Status colors
    const statusColors = {
        ACCEPTED: 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-800',
        PENDING: 'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-300 dark:border-yellow-800',
        CANCELLED: 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-800',
        REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
    };

    return (
        <div className="h-full w-full flex flex-col justify-start px-1 py-0.5 text-xs overflow-hidden">
            <div className="font-semibold truncate">{event.title}</div>
            <div className="flex items-center gap-1 opacity-80 truncate">
                <User className="w-3 h-3" />
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
        const booking = event.resource as CalBooking;
        let className = 'border-l-4 text-xs ';

        switch (booking.status) {
            case 'ACCEPTED':
            case 'PENDING':
                className += 'bg-emerald-100 border-emerald-500 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200';
                break;
            case 'IN_PROGRESS':
                className += 'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200';
                break;
            case 'COMPLETED':
                className += 'bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-950/30 dark:text-gray-300';
                break;
            case 'CANCELLED':
            case 'REJECTED':
                className += 'bg-red-100 border-red-500 text-red-900 opacity-60 line-through dark:bg-red-950/30 dark:text-red-200';
                break;
            case 'HOST_NO_SHOW':
            case 'GUEST_NO_SHOW':
                className += 'bg-orange-100 border-orange-500 text-orange-900 dark:bg-orange-950/30 dark:text-orange-200';
                break;
            default:
                className += 'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200';
                break;
        }

        return { className };
    };

    return (
        <div className="h-full space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">Sales Calendar</h2>
                    {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={selectedMember} onValueChange={setSelectedMember}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by Team Member" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Team Members</SelectItem>
                            {teamMembers.map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" onClick={fetchBookings}>
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <Card className="flex-1 min-h-[600px] border-border/50 bg-card/50 backdrop-blur-xl">
                <CardContent className="p-4 h-[700px]">
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
                        className="rounded-md"
                    />
                </CardContent>
            </Card>

            {/* Event Details Modal */}
            <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedEvent?.title}
                            <Badge
                                variant={['ACCEPTED', 'PENDING', 'COMPLETED'].includes(selectedEvent?.status || '') ? 'default' : 'secondary'}
                                className={cn(
                                    selectedEvent?.status === 'ACCEPTED' && 'bg-green-600',
                                    selectedEvent?.status === 'PENDING' && 'bg-emerald-600',
                                    selectedEvent?.status === 'IN_PROGRESS' && 'bg-blue-600',
                                    selectedEvent?.status === 'COMPLETED' && 'bg-gray-500',
                                    selectedEvent?.status === 'CANCELLED' && 'bg-red-600',
                                    selectedEvent?.status === 'HOST_NO_SHOW' && 'bg-orange-600',
                                    selectedEvent?.status === 'GUEST_NO_SHOW' && 'bg-orange-600'
                                )}
                            >
                                {selectedEvent?.status?.replace(/_/g, ' ')}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription>
                            {selectedEvent && format(new Date(selectedEvent.startTime), 'EEEE, MMMM d, yyyy')}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEvent && (
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">
                                    {format(new Date(selectedEvent.startTime), 'h:mm a')} - {format(new Date(selectedEvent.endTime), 'h:mm a')}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Attendees</div>
                                <div className="space-y-1">
                                    {selectedEvent.attendees.map((att, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-md">
                                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                {att.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium">{att.name}</div>
                                                <div className="text-xs text-muted-foreground">{att.email}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedEvent.description && (
                                <div className="space-y-1">
                                    <div className="text-sm font-medium">Description</div>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded-md">
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
