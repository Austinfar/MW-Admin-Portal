'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  Clock,
  User,
  Phone,
  Mail,
  Copy,
  ExternalLink,
  FileText,
  CalendarX,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { NextZoomData } from '@/types/sales-floor';
import Link from 'next/link';

interface NextZoomCardProps {
  data: NextZoomData | null;
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

export function NextZoomCard({ data }: NextZoomCardProps) {
  const [countdown, setCountdown] = useState(data?.startsIn || { hours: 0, minutes: 0, seconds: 0, totalMinutes: 0 });

  // Live countdown effect
  useEffect(() => {
    if (!data) return;

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(data.startTime);
      const diffMs = start.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, totalMinutes: 0 });
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const totalMinutes = Math.floor(diffMs / 60000);

      setCountdown({ hours, minutes, seconds, totalMinutes });
    }, 1000);

    return () => clearInterval(interval);
  }, [data]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (!data) {
    return (
      <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/5 shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-white flex items-center">
            <Video className="w-5 h-5 mr-2 text-emerald-400" />
            Next Call
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CalendarX className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">No upcoming calls scheduled</p>
            <p className="text-gray-500 text-xs mt-1">Check back later or book a call</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isStartingSoon = countdown.totalMinutes <= 15;
  const isStartingNow = countdown.totalMinutes <= 5;

  const platform = getMeetingPlatform(data.meetingLink);

  return (
    <Card className={`bg-zinc-900/40 backdrop-blur-xl border-white/5 shadow-2xl transition-all duration-500 ${isStartingNow ? 'border-emerald-500/50 shadow-emerald-500/20 shadow-lg' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-white flex items-center">
            <Video className="w-5 h-5 mr-2 text-emerald-400" />
            Next {platform.short}
          </CardTitle>
          {isStartingSoon && (
            <Badge variant="outline" className={`${isStartingNow ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 animate-pulse' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'}`}>
              {isStartingNow ? 'Starting Now!' : 'Starting Soon'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Countdown Timer */}
        <div className="flex items-center justify-center gap-2 py-4 bg-black/40 rounded-xl border border-white/5 backdrop-blur-md shadow-inner">
          <Clock className="w-5 h-5 text-emerald-400" />
          <div className="text-3xl font-bold text-white font-mono tracking-wider">
            {countdown.hours > 0 && (
              <>
                <span>{String(countdown.hours).padStart(2, '0')}</span>
                <span className="text-gray-500 mx-1">:</span>
              </>
            )}
            <span>{String(countdown.minutes).padStart(2, '0')}</span>
            <span className="text-gray-500 mx-1">:</span>
            <span>{String(countdown.seconds).padStart(2, '0')}</span>
          </div>
        </div>

        {/* Call Info */}
        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            {format(new Date(data.startTime), 'EEEE, MMM d')} at {format(new Date(data.startTime), 'h:mm a')}
          </p>
          <p className="text-white font-medium">{data.title}</p>
        </div>

        {/* Lead/Attendee Info */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="text-white font-medium">
                {data.lead
                  ? `${data.lead.first_name} ${data.lead.last_name}`
                  : data.attendee.name}
              </span>
            </div>
            {data.lead && (
              <Badge variant="outline" className="text-xs">
                {data.lead.status}
              </Badge>
            )}
          </div>

          {/* Contact Info */}
          <div className="flex flex-col gap-1.5">
            {(data.lead?.email || data.attendee.email) && (
              <button
                onClick={() => copyToClipboard(data.lead?.email || data.attendee.email, 'Email')}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{data.lead?.email || data.attendee.email}</span>
                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            {data.lead?.phone && (
              <button
                onClick={() => copyToClipboard(data.lead!.phone!, 'Phone')}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{data.lead.phone}</span>
                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>

          {/* Lead Source & Notes */}
          {data.lead?.source && (
            <div className="pt-2 border-t border-white/5">
              <span className="text-xs text-gray-500">Source: </span>
              <span className="text-xs text-gray-400">{data.lead.source}</span>
            </div>
          )}
          {data.lead?.description && (
            <div className="pt-1">
              <div className="flex items-start gap-2">
                <FileText className="w-3.5 h-3.5 text-gray-500 mt-0.5" />
                <p className="text-xs text-gray-400 line-clamp-2">{data.lead.description}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {data.meetingLink ? (
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(data.meetingLink!, '_blank', 'noopener,noreferrer');
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Video className="w-4 h-4 mr-2" />
              Join {getMeetingPlatform(data.meetingLink).name}
            </Button>
          ) : (
            <Button
              type="button"
              disabled
              className="flex-1 bg-gray-700 cursor-not-allowed"
            >
              <Video className="w-4 h-4 mr-2" />
              Join Call
            </Button>
          )}
          {data.lead && (
            <Button
              asChild
              variant="outline"
              className="border-gray-700 hover:bg-gray-800"
            >
              <Link href={`/leads/${data.lead.id}`}>
                <ExternalLink className="w-4 h-4" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
