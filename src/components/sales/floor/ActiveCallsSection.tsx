'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Video, User, Clock, ExternalLink, Users, AlertCircle, Play, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { ActiveCall } from '@/types/sales-floor';

interface ActiveCallsSectionProps {
  calls: ActiveCall[];
}

/**
 * Get meeting platform name from URL
 */
function getMeetingPlatform(url: string | null): { name: string; short: string } {
  if (!url) return { name: 'Call', short: 'Call' };

  if (url.includes('zoom.us')) {
    return { name: 'Zoom', short: 'Zoom' };
  }
  if (url.includes('meet.google.com')) {
    return { name: 'Google Meet', short: 'Meet' };
  }
  if (url.includes('teams.microsoft.com')) {
    return { name: 'Teams', short: 'Teams' };
  }

  return { name: 'Call', short: 'Call' };
}

function CallStatusBadge({ status, startTime, endTime }: { status: string; startTime: string; endTime: string }) {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  // Determine call status based on time and webhook status
  const isBeforeStart = now < start;
  const isAfterEnd = now > end;
  const isInProgress = status === 'IN_PROGRESS' || (!isBeforeStart && !isAfterEnd);

  if (isAfterEnd || status === 'COMPLETED') {
    return (
      <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/50 text-xs">
        <CheckCircle className="w-3 h-3 mr-1" />
        Call Complete
      </Badge>
    );
  }

  if (isBeforeStart) {
    return (
      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 text-xs">
        <Clock className="w-3 h-3 mr-1" />
        Not Started
      </Badge>
    );
  }

  // Active call
  return (
    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 text-xs">
      <Play className="w-3 h-3 mr-1" />
      Active
    </Badge>
  );
}

function ParticipantsList({
  host,
  guestName,
  lead
}: {
  host?: { name: string } | null;
  guestName: string;
  lead?: { id: string; first_name: string; last_name: string; status: string } | null;
}) {
  return (
    <div className="space-y-2">
      {/* Host */}
      {host && (
        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-black/20">
          <Users className="w-4 h-4 text-gray-400" />
          <div>
            <span className="text-xs text-gray-500 block">Host</span>
            <span className="text-sm text-white">{host.name}</span>
          </div>
        </div>
      )}

      {/* Guest/Lead */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-black/20">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <div>
            <span className="text-xs text-gray-500 block">Guest</span>
            <span className="text-sm text-white">{guestName}</span>
          </div>
        </div>
        {lead && (
          <Badge variant="outline" className="text-xs bg-white/5">
            {lead.status}
          </Badge>
        )}
      </div>

      {/* Lead link */}
      {lead && (
        <div className="flex items-center justify-end pt-1">
          <Link
            href={`/leads/${lead.id}`}
            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View Lead Profile
          </Link>
        </div>
      )}
    </div>
  );
}

function ActiveCallCard({ call, isExpanded }: { call: ActiveCall; isExpanded: boolean }) {
  const guestName = call.lead
    ? `${call.lead.first_name} ${call.lead.last_name}`
    : call.attendee.name;

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border transition-all duration-300
        ${isExpanded
          ? 'bg-gradient-to-br from-emerald-950/60 via-emerald-900/40 to-zinc-900/60 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
          : 'bg-emerald-950/40 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
        }
      `}
    >
      {/* Top right badges: Call Status + LIVE indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <CallStatusBadge
          status={call.status}
          startTime={call.startTime}
          endTime={call.endTime}
        />
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
      </div>

      <div className={`p-${isExpanded ? '6' : '4'}`}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`
            rounded-full bg-emerald-500/20 flex items-center justify-center
            ${isExpanded ? 'p-3' : 'p-2'}
          `}>
            <Phone className={`text-emerald-400 ${isExpanded ? 'w-6 h-6' : 'w-5 h-5'}`} />
          </div>
          <div className="flex-1 min-w-0 pr-24">
            <h3 className={`font-semibold text-white truncate ${isExpanded ? 'text-lg' : 'text-base'}`}>
              {call.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{call.startedAgo.formatted}</span>
              <span className="text-gray-600">|</span>
              <span>{call.endsIn.formatted}</span>
            </div>
          </div>
        </div>

        {/* Participants List (Invite List) */}
        <div className={`${isExpanded ? 'mb-5' : 'mb-4'}`}>
          <ParticipantsList
            host={call.host}
            guestName={guestName}
            lead={call.lead}
          />
        </div>

        {/* Join Button */}
        {call.meetingLink ? (
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(call.meetingLink!, '_blank', 'noopener,noreferrer');
            }}
            className={`
              w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium
              ${isExpanded ? 'h-12 text-base' : 'h-10 text-sm'}
            `}
          >
            <Video className="w-4 h-4 mr-2" />
            Join {getMeetingPlatform(call.meetingLink).name}
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400">No meeting link available</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ActiveCallsSection({ calls }: ActiveCallsSectionProps) {
  if (calls.length === 0) {
    return null;
  }

  const isSingleCall = calls.length === 1;

  return (
    <Card className="bg-zinc-900/40 backdrop-blur-xl border-emerald-500/20 shadow-2xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-white/5">
        <CardTitle className="text-lg font-medium text-white flex items-center gap-2">
          <div className="relative">
            <Phone className="w-5 h-5 text-emerald-400" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          Active Call{calls.length > 1 ? 's' : ''}
          <Badge className="ml-2 bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
            {calls.length} Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isSingleCall ? (
          // Single call - expanded view
          <ActiveCallCard call={calls[0]} isExpanded={true} />
        ) : (
          // Multiple calls - compact grid
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {calls.map((call) => (
              <ActiveCallCard key={call.id} call={call} isExpanded={false} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
