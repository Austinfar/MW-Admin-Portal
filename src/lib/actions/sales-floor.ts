'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { calClient, CalBooking } from '@/lib/cal/client';
import { stripe } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addHours,
  differenceInMinutes,
  differenceInHours,
  format,
} from 'date-fns';
import type {
  NextZoomData,
  UpcomingCall,
  CloserStats,
  SetterStats,
  QuotaProgress,
  FollowUpTask,
  FollowUpOutcomeType,
  SalesResource,
  LeadToWork,
  CloserLeaderboardItem,
  SetterLeaderboardItem,
  LeaderboardPeriod,
} from '@/types/sales-floor';

// ============================================
// Helper Functions
// ============================================

async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user.id;
  } catch (e) {
    // Fall through
  }

  // Fall back to first active user (for dev)
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  return data?.id || null;
}

function calculateTimeUntil(startTime: string): { hours: number; minutes: number; seconds: number; totalMinutes: number; formatted: string } {
  const now = new Date();
  const start = new Date(startTime);
  const totalMinutes = Math.max(0, differenceInMinutes(start, now));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.max(0, Math.floor((start.getTime() - now.getTime()) / 1000) % 60);

  let formatted = '';
  if (totalMinutes <= 0) {
    formatted = 'Starting now';
  } else if (totalMinutes < 60) {
    formatted = `${minutes}m`;
  } else {
    formatted = `${hours}h ${minutes}m`;
  }

  return { hours, minutes, seconds, totalMinutes, formatted };
}

function getDateRange(period: 'today' | 'week' | 'month'): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfDay(now) };
  }
}

// ============================================
// Next Zoom / Upcoming Calls
// ============================================

/**
 * Get the next upcoming Zoom call for a user with enriched lead data
 */
export async function getNextZoom(userId?: string): Promise<NextZoomData | null> {
  try {
    const now = new Date();
    const endRange = addHours(now, 48); // Look ahead 48 hours

    // Get Cal.com bookings
    const bookings = await calClient.getBookings(now, endRange);

    // Filter to accepted bookings starting after now, sort by start time
    const upcomingBookings = bookings
      .filter(b => b.status === 'ACCEPTED' && new Date(b.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    if (upcomingBookings.length === 0) {
      return null;
    }

    const nextBooking = upcomingBookings[0];
    const attendee = nextBooking.attendees[0];

    // Try to match to a lead by email
    const admin = createAdminClient();
    let lead = null;

    if (attendee?.email) {
      const { data: leadData } = await admin
        .from('leads')
        .select('id, first_name, last_name, email, phone, status, source, description')
        .eq('email', attendee.email)
        .single();

      lead = leadData;
    }

    const timeUntil = calculateTimeUntil(nextBooking.startTime);

    return {
      id: String(nextBooking.id),
      title: nextBooking.title,
      startTime: nextBooking.startTime,
      endTime: nextBooking.endTime,
      meetingLink: null, // Cal.com API doesn't expose meeting links directly
      attendee: {
        name: attendee?.name || 'Unknown',
        email: attendee?.email || '',
      },
      lead,
      startsIn: timeUntil,
    };
  } catch (error) {
    console.error('[SalesFloor] Error fetching next zoom:', error);
    return null;
  }
}

/**
 * Get upcoming calls list for the next 24-48 hours
 */
export async function getUpcomingCalls(hours: number = 48): Promise<UpcomingCall[]> {
  try {
    const now = new Date();
    const endRange = addHours(now, hours);

    const bookings = await calClient.getBookings(now, endRange);
    const admin = createAdminClient();

    // Get all attendee emails to batch lookup leads
    const attendeeEmails = bookings
      .filter(b => b.status === 'ACCEPTED' && b.attendees[0]?.email)
      .map(b => b.attendees[0].email);

    // Batch lookup leads
    const { data: leads } = await admin
      .from('leads')
      .select('id, first_name, last_name, email, phone, status')
      .in('email', attendeeEmails);

    const leadsByEmail = new Map(leads?.map(l => [l.email, l]) || []);

    return bookings
      .filter(b => b.status === 'ACCEPTED' && new Date(b.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map(booking => {
        const attendee = booking.attendees[0];
        const lead = attendee?.email ? leadsByEmail.get(attendee.email) || null : null;
        const timeUntil = calculateTimeUntil(booking.startTime);

        return {
          id: String(booking.id),
          title: booking.title,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          meetingLink: null,
          attendee: {
            name: attendee?.name || 'Unknown',
            email: attendee?.email || '',
          },
          lead,
          startsIn: {
            hours: timeUntil.hours,
            minutes: timeUntil.minutes,
            formatted: timeUntil.formatted,
          },
        };
      });
  } catch (error) {
    console.error('[SalesFloor] Error fetching upcoming calls:', error);
    return [];
  }
}

// ============================================
// Personal Stats
// ============================================

/**
 * Get closer stats for a user
 */
export async function getCloserStats(
  userId: string,
  period: 'today' | 'week' | 'month' = 'month'
): Promise<CloserStats> {
  try {
    const { start, end } = getDateRange(period);
    const admin = createAdminClient();

    // Get user's quota
    const { data: user } = await admin
      .from('users')
      .select('revenue_quota_monthly, deals_quota_monthly')
      .eq('id', userId)
      .single();

    // Get revenue from Stripe charges where salesCloserId matches
    const charges = await stripe.charges.list({
      limit: 100,
      created: {
        gte: Math.floor(start.getTime() / 1000),
        lte: Math.floor(end.getTime() / 1000),
      },
    });

    // Filter charges by this closer (using metadata.salesCloserId)
    const userCharges = charges.data.filter(
      c => c.status === 'succeeded' && c.metadata?.salesCloserId === userId
    );

    const revenue = userCharges.reduce((sum, c) => sum + c.amount / 100, 0);
    const deals = userCharges.length;

    // Get calls taken from sales_call_logs
    const { data: callLogs, count: callsTaken } = await admin
      .from('sales_call_logs')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Calculate close rate (deals / calls taken)
    const closeRate = (callsTaken || 0) > 0 ? (deals / (callsTaken || 1)) * 100 : 0;

    // Get pending commissions
    const { data: pendingCommissions } = await admin
      .from('commission_ledger')
      .select('commission_amount')
      .eq('user_id', userId)
      .eq('status', 'pending');

    const pendingTotal = pendingCommissions?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;

    // Calculate quota progress
    const revenueQuota = user?.revenue_quota_monthly || null;
    const dealsQuota = user?.deals_quota_monthly || null;

    const quotaProgress: QuotaProgress = {
      revenue: {
        current: revenue,
        target: revenueQuota,
        percentage: revenueQuota ? Math.min(100, (revenue / revenueQuota) * 100) : 0,
      },
      deals: {
        current: deals,
        target: dealsQuota,
        percentage: dealsQuota ? Math.min(100, (deals / dealsQuota) * 100) : 0,
      },
    };

    return {
      period,
      revenue,
      deals,
      callsTaken: callsTaken || 0,
      closeRate: Math.round(closeRate * 10) / 10,
      pendingCommissions: pendingTotal,
      quotaProgress,
    };
  } catch (error) {
    console.error('[SalesFloor] Error fetching closer stats:', error);
    return {
      period,
      revenue: 0,
      deals: 0,
      callsTaken: 0,
      closeRate: 0,
      pendingCommissions: 0,
      quotaProgress: {
        revenue: { current: 0, target: null, percentage: 0 },
        deals: { current: 0, target: null, percentage: 0 },
      },
    };
  }
}

/**
 * Get setter stats for a user
 */
export async function getSetterStats(
  userId: string,
  period: 'today' | 'week' | 'month' = 'month'
): Promise<SetterStats> {
  try {
    const { start, end } = getDateRange(period);
    const admin = createAdminClient();

    // Get user's quota
    const { data: user } = await admin
      .from('users')
      .select('bookings_quota_monthly')
      .eq('id', userId)
      .single();

    // Get leads booked by this setter
    const { data: bookedLeads, count: bookings } = await admin
      .from('leads')
      .select('id, email, status', { count: 'exact' })
      .eq('booked_by_user_id', userId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Get shows (leads that have sales_call_logs)
    const bookedLeadIds = bookedLeads?.map(l => l.id) || [];
    let shows = 0;

    if (bookedLeadIds.length > 0) {
      const { count: showCount } = await admin
        .from('sales_call_logs')
        .select('id', { count: 'exact' })
        .in('client_id', bookedLeadIds)
        .gte('created_at', start.toISOString());

      shows = showCount || 0;
    }

    // Get conversions (leads that became clients)
    const { count: conversions } = await admin
      .from('clients')
      .select('id', { count: 'exact' })
      .eq('appointment_setter_id', userId)
      .gte('start_date', start.toISOString())
      .lte('start_date', end.toISOString());

    const showRate = (bookings || 0) > 0 ? (shows / (bookings || 1)) * 100 : 0;
    const conversionRate = (bookings || 0) > 0 ? ((conversions || 0) / (bookings || 1)) * 100 : 0;

    // Get pending commissions
    const { data: pendingCommissions } = await admin
      .from('commission_ledger')
      .select('commission_amount')
      .eq('user_id', userId)
      .eq('status', 'pending');

    const pendingTotal = pendingCommissions?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;

    // Calculate quota progress
    const bookingsQuota = user?.bookings_quota_monthly || null;

    const quotaProgress: QuotaProgress = {
      revenue: { current: 0, target: null, percentage: 0 }, // Setters don't have revenue quota
      deals: { current: conversions || 0, target: null, percentage: 0 },
      bookings: {
        current: bookings || 0,
        target: bookingsQuota,
        percentage: bookingsQuota ? Math.min(100, ((bookings || 0) / bookingsQuota) * 100) : 0,
      },
    };

    return {
      period,
      bookings: bookings || 0,
      shows,
      showRate: Math.round(showRate * 10) / 10,
      conversions: conversions || 0,
      conversionRate: Math.round(conversionRate * 10) / 10,
      pendingCommissions: pendingTotal,
      quotaProgress,
    };
  } catch (error) {
    console.error('[SalesFloor] Error fetching setter stats:', error);
    return {
      period,
      bookings: 0,
      shows: 0,
      showRate: 0,
      conversions: 0,
      conversionRate: 0,
      pendingCommissions: 0,
      quotaProgress: {
        revenue: { current: 0, target: null, percentage: 0 },
        deals: { current: 0, target: null, percentage: 0 },
        bookings: { current: 0, target: null, percentage: 0 },
      },
    };
  }
}

// ============================================
// Follow-Up Tasks
// ============================================

/**
 * Get follow-up tasks for a user
 */
export async function getFollowUpTasks(userId: string): Promise<FollowUpTask[]> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('follow_up_tasks')
      .select(`
        *,
        lead:leads (
          id,
          first_name,
          last_name,
          email,
          phone,
          status
        )
      `)
      .eq('assigned_to', userId)
      .eq('status', 'pending')
      .order('callback_date', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('[SalesFloor] Error fetching follow-up tasks:', error);
      return [];
    }

    return data as FollowUpTask[];
  } catch (error) {
    console.error('[SalesFloor] Error fetching follow-up tasks:', error);
    return [];
  }
}

/**
 * Create a follow-up task after a call
 */
export async function createFollowUpTask(data: {
  leadId: string;
  assignedTo: string;
  outcomeType: FollowUpOutcomeType;
  callbackDate?: string;
  notes?: string;
  sourceCallLogId?: string;
}): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const admin = createAdminClient();
    const currentUserId = await getCurrentUserId();

    const { data: task, error } = await admin
      .from('follow_up_tasks')
      .insert({
        lead_id: data.leadId,
        assigned_to: data.assignedTo,
        outcome_type: data.outcomeType,
        callback_date: data.callbackDate || null,
        notes: data.notes || null,
        source_call_log_id: data.sourceCallLogId || null,
        created_by: currentUserId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[SalesFloor] Error creating follow-up task:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/sales-floor');
    return { success: true, taskId: task.id };
  } catch (error: any) {
    console.error('[SalesFloor] Error creating follow-up task:', error);
    return { success: false, error: error?.message || 'Failed to create task' };
  }
}

/**
 * Update a follow-up task status
 */
export async function updateFollowUpTask(
  taskId: string,
  status: 'completed' | 'converted',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    const updateData: any = {
      status,
      completed_at: new Date().toISOString(),
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { error } = await admin
      .from('follow_up_tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      console.error('[SalesFloor] Error updating follow-up task:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/sales-floor');
    return { success: true };
  } catch (error: any) {
    console.error('[SalesFloor] Error updating follow-up task:', error);
    return { success: false, error: error?.message || 'Failed to update task' };
  }
}

/**
 * Reschedule a follow-up task
 */
export async function rescheduleFollowUpTask(
  taskId: string,
  newCallbackDate: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    const updateData: any = {
      callback_date: newCallbackDate,
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { error } = await admin
      .from('follow_up_tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      console.error('[SalesFloor] Error rescheduling task:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/sales-floor');
    return { success: true };
  } catch (error: any) {
    console.error('[SalesFloor] Error rescheduling task:', error);
    return { success: false, error: error?.message || 'Failed to reschedule task' };
  }
}

// ============================================
// Leaderboard
// ============================================

/**
 * Get closer leaderboard
 */
export async function getCloserLeaderboard(
  period: LeaderboardPeriod = 'month',
  currentUserId?: string
): Promise<CloserLeaderboardItem[]> {
  try {
    const { start, end } = getDateRange(period);
    const admin = createAdminClient();

    // Get all closers
    const { data: closers } = await admin
      .from('users')
      .select('id, name, avatar_url')
      .eq('is_active', true)
      .in('job_title', ['closer', 'head_coach']);

    if (!closers || closers.length === 0) {
      return [];
    }

    // Get Stripe charges for the period
    const charges = await stripe.charges.list({
      limit: 100,
      created: {
        gte: Math.floor(start.getTime() / 1000),
        lte: Math.floor(end.getTime() / 1000),
      },
    });

    // Aggregate by closer
    const closerStats = new Map<string, { revenue: number; deals: number }>();

    charges.data.forEach(charge => {
      if (charge.status === 'succeeded' && charge.metadata?.salesCloserId) {
        const closerId = charge.metadata.salesCloserId;
        const current = closerStats.get(closerId) || { revenue: 0, deals: 0 };
        current.revenue += charge.amount / 100;
        current.deals += 1;
        closerStats.set(closerId, current);
      }
    });

    // Build leaderboard
    const leaderboard: CloserLeaderboardItem[] = closers.map(closer => {
      const stats = closerStats.get(closer.id) || { revenue: 0, deals: 0 };
      return {
        id: closer.id,
        name: closer.name || 'Unknown',
        avatar_url: closer.avatar_url,
        revenue: stats.revenue,
        deals: stats.deals,
        closeRate: 0, // Would need call data to calculate
        rank: 0,
        trend: 'same' as const,
        isCurrentUser: closer.id === currentUserId,
      };
    });

    // Sort by revenue and assign ranks
    leaderboard.sort((a, b) => b.revenue - a.revenue);
    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });

    return leaderboard;
  } catch (error) {
    console.error('[SalesFloor] Error fetching closer leaderboard:', error);
    return [];
  }
}

/**
 * Get setter leaderboard
 */
export async function getSetterLeaderboard(
  period: LeaderboardPeriod = 'month',
  currentUserId?: string
): Promise<SetterLeaderboardItem[]> {
  try {
    const { start, end } = getDateRange(period);
    const admin = createAdminClient();

    // Get all setters (users with job_title that could set appointments)
    const { data: setters } = await admin
      .from('users')
      .select('id, name, avatar_url')
      .eq('is_active', true);

    if (!setters || setters.length === 0) {
      return [];
    }

    // Get booking counts per setter
    const { data: bookingCounts } = await admin
      .from('leads')
      .select('booked_by_user_id')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .not('booked_by_user_id', 'is', null);

    // Aggregate bookings by setter
    const setterBookings = new Map<string, number>();
    bookingCounts?.forEach(lead => {
      if (lead.booked_by_user_id) {
        setterBookings.set(
          lead.booked_by_user_id,
          (setterBookings.get(lead.booked_by_user_id) || 0) + 1
        );
      }
    });

    // Build leaderboard (only include setters with bookings)
    const leaderboard: SetterLeaderboardItem[] = setters
      .filter(setter => setterBookings.has(setter.id))
      .map(setter => ({
        id: setter.id,
        name: setter.name || 'Unknown',
        avatar_url: setter.avatar_url,
        bookings: setterBookings.get(setter.id) || 0,
        shows: 0, // Would need to calculate from call logs
        showRate: 0,
        conversions: 0,
        rank: 0,
        trend: 'same' as const,
        isCurrentUser: setter.id === currentUserId,
      }));

    // Sort by bookings and assign ranks
    leaderboard.sort((a, b) => b.bookings - a.bookings);
    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });

    return leaderboard;
  } catch (error) {
    console.error('[SalesFloor] Error fetching setter leaderboard:', error);
    return [];
  }
}

// ============================================
// Resources
// ============================================

/**
 * Get sales floor resources
 */
export async function getSalesResources(): Promise<SalesResource[]> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('sales_floor_resources')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('sort_order');

    if (error) {
      console.error('[SalesFloor] Error fetching resources:', error);
      return [];
    }

    return data as SalesResource[];
  } catch (error) {
    console.error('[SalesFloor] Error fetching resources:', error);
    return [];
  }
}

// ============================================
// Leads to Work (Setter Mode)
// ============================================

/**
 * Get leads assigned to a setter that need outreach
 */
export async function getLeadsToWork(userId: string): Promise<LeadToWork[]> {
  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('leads')
      .select('id, first_name, last_name, email, phone, status, source, created_at')
      .or(`booked_by_user_id.eq.${userId},status.eq.New`)
      .not('status', 'in', '("Converted", "Lost")')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[SalesFloor] Error fetching leads to work:', error);
      return [];
    }

    return (data || []).map(lead => ({
      ...lead,
      assigned_setter_id: userId,
    })) as LeadToWork[];
  } catch (error) {
    console.error('[SalesFloor] Error fetching leads to work:', error);
    return [];
  }
}

// ============================================
// Update User Quotas (Admin)
// ============================================

/**
 * Update a user's quotas
 */
export async function updateUserQuotas(
  userId: string,
  quotas: {
    revenue_quota_monthly?: number | null;
    deals_quota_monthly?: number | null;
    bookings_quota_monthly?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    const { error } = await admin
      .from('users')
      .update({
        ...quotas,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[SalesFloor] Error updating quotas:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/sales-floor');
    revalidatePath('/settings/team');
    return { success: true };
  } catch (error: any) {
    console.error('[SalesFloor] Error updating quotas:', error);
    return { success: false, error: error?.message || 'Failed to update quotas' };
  }
}
