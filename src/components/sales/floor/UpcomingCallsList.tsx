'use client';

import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  User,
  Video,
  ExternalLink,
  CalendarDays,
  ClipboardCheck,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import type { UpcomingCall } from '@/types/sales-floor';
import Link from 'next/link';

interface UpcomingCallsListProps {
  calls: UpcomingCall[];
  onOpenCalendar?: () => void;
  onLogOutcome?: (call: UpcomingCall) => void;
}

function CallItem({ call, onLogOutcome }: { call: UpcomingCall; onLogOutcome?: (call: UpcomingCall) => void }) {
  const startDate = new Date(call.startTime);
  const endDate = new Date(call.endTime);
  const isStartingSoon = call.startsIn.hours === 0 && call.startsIn.minutes <= 30;
  const hasEnded = isPast(endDate);
  const isInProgress = isPast(startDate) && !hasEnded;

  // Determine day label
  let dayLabel = format(startDate, 'EEE, MMM d');
  if (isToday(startDate)) {
    dayLabel = 'Today';
  } else if (isTomorrow(startDate)) {
    dayLabel = 'Tomorrow';
  }

  return (
    <div className={`p-3 rounded-lg border transition-colors ${
      hasEnded
        ? 'bg-gray-900/20 border-gray-800/30'
        : isInProgress
        ? 'bg-blue-950/30 border-blue-800/50'
        : isStartingSoon
        ? 'bg-emerald-950/30 border-emerald-800/50'
        : 'bg-gray-900/30 border-gray-800/50 hover:bg-gray-900/50'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Time & Day */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${
              hasEnded ? 'text-gray-500' :
              isInProgress ? 'text-blue-400' :
              isStartingSoon ? 'text-emerald-400' : 'text-white'
            }`}>
              {format(startDate, 'h:mm a')}
            </span>
            <span className="text-xs text-gray-500">{dayLabel}</span>
            {hasEnded && (
              <Badge variant="outline" className="text-xs bg-gray-500/20 text-gray-400 border-gray-500/50">
                Ended
              </Badge>
            )}
            {isInProgress && (
              <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/50">
                In Progress
              </Badge>
            )}
            {!hasEnded && !isInProgress && isStartingSoon && (
              <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                {call.startsIn.formatted}
              </Badge>
            )}
          </div>

          {/* Lead Name */}
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm text-gray-300 truncate">
              {call.lead
                ? `${call.lead.first_name} ${call.lead.last_name}`
                : call.attendee.name}
            </span>
            {call.lead && (
              <Badge variant="outline" className="text-xs">
                {call.lead.status}
              </Badge>
            )}
          </div>

          {/* Call Title */}
          <p className="text-xs text-gray-500 mt-1 truncate">{call.title}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Log Outcome button for ended/in-progress calls */}
          {(hasEnded || isInProgress) && call.lead && onLogOutcome && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLogOutcome(call)}
              className="h-8 px-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
            >
              <ClipboardCheck className="w-4 h-4 mr-1" />
              <span className="text-xs">Log</span>
            </Button>
          )}
          {call.lead && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
            >
              <Link href={`/leads/${call.lead.id}`}>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </Button>
          )}
          {call.meetingLink ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300"
            >
              <a href={call.meetingLink} target="_blank" rel="noopener noreferrer">
                <Video className="w-4 h-4" />
              </a>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="h-8 w-8 p-0 text-gray-600"
            >
              <Video className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function UpcomingCallsList({ calls, onOpenCalendar, onLogOutcome }: UpcomingCallsListProps) {
  // Group calls by day
  const groupedCalls = calls.reduce((groups, call) => {
    const date = new Date(call.startTime);
    let key = format(date, 'yyyy-MM-dd');

    if (isToday(date)) {
      key = 'today';
    } else if (isTomorrow(date)) {
      key = 'tomorrow';
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(call);
    return groups;
  }, {} as Record<string, UpcomingCall[]>);

  const todayCalls = groupedCalls['today'] || [];
  const tomorrowCalls = groupedCalls['tomorrow'] || [];
  const otherCalls = Object.entries(groupedCalls)
    .filter(([key]) => key !== 'today' && key !== 'tomorrow')
    .flatMap(([_, calls]) => calls);

  return (
    <Card className="bg-[#1A1A1A] border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-white flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-400" />
            Upcoming Calls
          </CardTitle>
          {onOpenCalendar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCalendar}
              className="text-gray-400 hover:text-white"
            >
              <CalendarDays className="w-4 h-4 mr-1" />
              Full Calendar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">No calls scheduled</p>
            <p className="text-gray-500 text-xs mt-1">Next 48 hours are clear</p>
          </div>
        ) : (
          <>
            {/* Today's Calls */}
            {todayCalls.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
                    Today
                  </span>
                  <span className="text-xs text-gray-500">
                    {todayCalls.length} call{todayCalls.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {todayCalls.map(call => (
                    <CallItem key={call.id} call={call} onLogOutcome={onLogOutcome} />
                  ))}
                </div>
              </div>
            )}

            {/* Tomorrow's Calls */}
            {tomorrowCalls.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-blue-400 uppercase tracking-wide">
                    Tomorrow
                  </span>
                  <span className="text-xs text-gray-500">
                    {tomorrowCalls.length} call{tomorrowCalls.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {tomorrowCalls.map(call => (
                    <CallItem key={call.id} call={call} onLogOutcome={onLogOutcome} />
                  ))}
                </div>
              </div>
            )}

            {/* Other Days */}
            {otherCalls.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Later
                  </span>
                  <span className="text-xs text-gray-500">
                    {otherCalls.length} call{otherCalls.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {otherCalls.map(call => (
                    <CallItem key={call.id} call={call} onLogOutcome={onLogOutcome} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
