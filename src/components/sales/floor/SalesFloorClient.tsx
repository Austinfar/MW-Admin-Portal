'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ViewModeToggle } from './ViewModeToggle';
import { ActiveCallsSection } from './ActiveCallsSection';
import { NextZoomCard } from './NextZoomCard';
import { MyStatsPanel } from './MyStatsPanel';
import { UpcomingCallsList } from './UpcomingCallsList';
import { FollowUpQueue } from './FollowUpQueue';
import { CallOutcomeDialog } from './CallOutcomeDialog';
import { EnhancedLeaderboard, Leaderboard } from './Leaderboard';
import { LiveTicker } from './LiveTicker';
import { PipelineFunnel } from './PipelineFunnel';
import { StreakCounter } from './StreakCounter';
import { WarRoom } from './WarRoom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import SalesCalendar from '@/components/sales/SalesCalendar';
import type {
  SalesFloorViewMode,
  ActiveCall,
  NextZoomData,
  UpcomingCall,
  CloserStats,
  SetterStats,
  CloserLeaderboardItem,
  SetterLeaderboardItem,
  FollowUpTask,
  CallOutcome,
} from '@/types/sales-floor';
import type { TickerItem, FunnelData, StreakItem, LeaderboardItem } from '@/lib/actions/sales-dashboard';
import type { CalUserLink, CalUserLinkWithUser } from '@/lib/actions/cal-links';

interface SalesFloorClientProps {
  // User info
  userId: string;
  userJobTitle?: string | null;

  // Initial data from server
  ticker: TickerItem[];
  funnel: FunnelData;
  streaks: StreakItem[];
  legacyLeaderboard: LeaderboardItem[];

  // New data
  activeCalls: ActiveCall[];
  nextZoom: NextZoomData | null;
  upcomingCalls: UpcomingCall[];
  closerStats: CloserStats | null;
  setterStats: SetterStats | null;
  closerLeaderboard: CloserLeaderboardItem[];
  setterLeaderboard: SetterLeaderboardItem[];
  followUpTasks: FollowUpTask[];
  recentAnalyzedCalls: any[]; // Using loose type to avoid conflicting with server schema import complexity

  // Booking links data
  globalCalendarUrl?: string | null;
  userCalLinks?: CalUserLink[];
  allConsultLinks?: CalUserLinkWithUser[];
}

import { SalesCallAnalyzerWidget } from './SalesCallAnalyzerWidget';

export function SalesFloorClient({
  userId,
  userJobTitle,
  ticker,
  funnel,
  streaks,
  legacyLeaderboard,
  activeCalls,
  nextZoom,
  upcomingCalls,
  closerStats,
  setterStats,
  closerLeaderboard,
  setterLeaderboard,
  followUpTasks,
  recentAnalyzedCalls = [],
  globalCalendarUrl,
  userCalLinks = [],
  allConsultLinks = [],
}: SalesFloorClientProps) {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<SalesFloorViewMode>(() => {
    // Infer default from job title
    if (userJobTitle === 'closer' || userJobTitle === 'head_coach') return 'closer';
    return 'closer'; // Default to closer
  });

  const [calendarOpen, setCalendarOpen] = useState(false);

  // Call outcome dialog state
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [selectedCallForOutcome, setSelectedCallForOutcome] = useState<UpcomingCall | null>(null);

  const handleModeChange = useCallback((mode: SalesFloorViewMode) => {
    setViewMode(mode);
  }, []);

  const handleOpenCalendar = useCallback(() => {
    setCalendarOpen(true);
  }, []);

  const handleLogOutcome = useCallback((call: UpcomingCall) => {
    setSelectedCallForOutcome(call);
    setOutcomeDialogOpen(true);
  }, []);

  const handleOutcomeLogged = useCallback(() => {
    // Refresh the page data to update follow-up tasks and stats
    router.refresh();
  }, [router]);

  const handleTaskUpdated = useCallback(() => {
    // Refresh the page data when a follow-up task is completed/rescheduled
    router.refresh();
  }, [router]);

  /* Real-time Widget State */
  const supabase = createClient();
  const [analyzedCalls, setAnalyzedCalls] = useState(recentAnalyzedCalls);

  useEffect(() => {
    // Initial sync
    setAnalyzedCalls(recentAnalyzedCalls);
  }, [recentAnalyzedCalls]);

  useEffect(() => {
    const channel = supabase
      .channel('sales_floor_widget')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_call_logs' },
        (payload) => {
          console.log('Realtime Widget Event:', payload);
          if (payload.eventType === 'INSERT') {
            setAnalyzedCalls((prev) => {
              const updated = [payload.new, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3);
              return updated;
            });
          } else if (payload.eventType === 'UPDATE') {
            setAnalyzedCalls((prev) => prev.map(item => item.id === payload.new.id ? payload.new : item));
          } else if (payload.eventType === 'DELETE') {
            setAnalyzedCalls((prev) => prev.filter(item => item.id !== payload.old.id));
            router.refresh();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, router]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#09090b] overflow-x-hidden">
      {/* Top Bar: Live Ticker */}
      <LiveTicker items={ticker} />

      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        {/* Header with View Mode Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Sales Floor</h2>
            <p className="text-muted-foreground">
              {viewMode === 'closer'
                ? 'Take calls, close deals, track your revenue.'
                : 'Book quality appointments, track your show rate.'}
            </p>
          </div>
          <ViewModeToggle
            userJobTitle={userJobTitle}
            onModeChange={handleModeChange}
          />
        </div>

        {/* HUD Row: Quick Metrics & Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <StreakCounter streaks={streaks} />
          </div>
          <div className="md:col-span-2">
            <PipelineFunnel data={funnel} />
          </div>
          <div className="md:col-span-1">
            <WarRoom
              globalCalendarUrl={globalCalendarUrl}
              userLinks={userCalLinks}
              allConsultLinks={allConsultLinks}
              currentUserJobTitle={userJobTitle}
            />
          </div>
        </div>

        {/* Active Calls Section - Shows prominently when calls are in progress */}
        {activeCalls.length > 0 && (
          <ActiveCallsSection calls={activeCalls} />
        )}

        {/* Main Content Grid - New Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Next Call + My Stats */}
          <div className="lg:col-span-3 space-y-6">
            <NextZoomCard data={nextZoom} />
            <MyStatsPanel
              mode={viewMode}
              closerStats={closerStats || undefined}
              setterStats={setterStats || undefined}
            />
          </div>

          {/* Center Column: Upcoming Calls + Follow-Up Queue */}
          <div className="lg:col-span-5 space-y-6">
            <UpcomingCallsList
              calls={upcomingCalls}
              onOpenCalendar={handleOpenCalendar}
              onLogOutcome={handleLogOutcome}
            />
            {viewMode === 'closer' && (
              <FollowUpQueue
                tasks={followUpTasks}
                onTaskUpdated={handleTaskUpdated}
              />
            )}
          </div>

          {/* Right Column: Leaderboard (Sticky) */}
          <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-6">
            <SalesCallAnalyzerWidget recentCalls={analyzedCalls} />

            {closerLeaderboard.length > 0 || setterLeaderboard.length > 0 ? (
              <EnhancedLeaderboard
                mode={viewMode}
                closerData={closerLeaderboard}
                setterData={setterLeaderboard}
              />
            ) : (
              <Leaderboard data={legacyLeaderboard} />
            )}
          </div>
        </div>
      </div>

      {/* Calendar Sheet (Slide-out) */}
      <Sheet open={calendarOpen} onOpenChange={setCalendarOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl bg-[#0a0a0a] border-gray-800">
          <SheetHeader>
            <SheetTitle className="text-white">Full Calendar</SheetTitle>
          </SheetHeader>
          <div className="mt-4 h-[calc(100vh-100px)]">
            <SalesCalendar />
          </div>
        </SheetContent>
      </Sheet>

      {/* Call Outcome Dialog */}
      {selectedCallForOutcome && selectedCallForOutcome.lead && (
        <CallOutcomeDialog
          open={outcomeDialogOpen}
          onOpenChange={setOutcomeDialogOpen}
          leadId={selectedCallForOutcome.lead.id}
          leadName={`${selectedCallForOutcome.lead.first_name} ${selectedCallForOutcome.lead.last_name}`}
          closerId={userId}
          onOutcomeLogged={handleOutcomeLogged}
        />
      )}
    </div>
  );
}
