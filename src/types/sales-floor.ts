/**
 * Sales Floor Types
 * Types for the Sales Floor page components and data
 */

// ============================================
// View Mode Types
// ============================================

export type SalesFloorViewMode = 'closer' | 'setter';

// ============================================
// Follow-Up Task Types
// ============================================

export type FollowUpOutcomeType =
  | 'follow_up_zoom'
  | 'send_proposal'
  | 'needs_nurture'
  | 'lost'
  | 'no_show';

export type FollowUpTaskStatus = 'pending' | 'completed' | 'converted';

export interface FollowUpTask {
  id: string;
  lead_id: string;
  assigned_to: string;
  outcome_type: FollowUpOutcomeType;
  callback_date: string | null;
  notes: string | null;
  status: FollowUpTaskStatus;
  source_call_log_id: string | null;
  created_at: string;
  completed_at: string | null;
  created_by: string | null;
  // Joined data
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
}

// ============================================
// Quota Types
// ============================================

export interface UserQuotas {
  revenue_quota_monthly: number | null;
  deals_quota_monthly: number | null;
  bookings_quota_monthly: number | null;
}

export interface QuotaProgress {
  revenue: {
    current: number;
    target: number | null;
    percentage: number;
  };
  deals: {
    current: number;
    target: number | null;
    percentage: number;
  };
  bookings?: {
    current: number;
    target: number | null;
    percentage: number;
  };
}

// ============================================
// Active Call Types
// ============================================

export interface ActiveCall {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  meetingLink: string | null;
  attendee: {
    name: string;
    email: string;
  };
  host?: {
    id: string;
    name: string;
    email: string;
  } | null;
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    status: string;
  } | null;
  // Time info
  startedAgo: {
    minutes: number;
    formatted: string; // e.g., "Started 5m ago"
  };
  endsIn: {
    minutes: number;
    formatted: string; // e.g., "Ends in 25m"
  };
}

// ============================================
// Next Call / Upcoming Calls Types
// ============================================

export interface NextZoomData {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  meetingLink: string | null;
  attendee: {
    name: string;
    email: string;
  };
  // Enriched lead data (if matched)
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    status: string;
    source: string | null;
    description: string | null;
  } | null;
  // Time calculations
  startsIn: {
    hours: number;
    minutes: number;
    seconds: number;
    totalMinutes: number;
  };
}

export interface UpcomingCall {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  meetingLink: string | null;
  attendee: {
    name: string;
    email: string;
  };
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    status: string;
  } | null;
  startsIn: {
    hours: number;
    minutes: number;
    formatted: string; // e.g., "2h 15m" or "Starting soon"
  };
}

// ============================================
// Personal Stats Types
// ============================================

export interface CloserStats {
  period: 'today' | 'week' | 'month';
  revenue: number;
  deals: number;
  callsTaken: number;
  closeRate: number; // percentage (showed -> closed)
  pendingCommissions: number;
  quotaProgress: QuotaProgress;
}

export interface SetterStats {
  period: 'today' | 'week' | 'month';
  bookings: number;
  shows: number;
  showRate: number; // percentage (booked -> showed)
  conversions: number; // leads that closed from their bookings
  conversionRate: number; // percentage
  pendingCommissions: number;
  quotaProgress: QuotaProgress;
}

export type PersonalStats = CloserStats | SetterStats;

// ============================================
// Leaderboard Types
// ============================================

export type LeaderboardPeriod = 'today' | 'week' | 'month';

export interface CloserLeaderboardItem {
  id: string;
  name: string;
  avatar_url: string | null;
  revenue: number;
  deals: number;
  closeRate: number;
  rank: number;
  trend: 'up' | 'down' | 'same'; // compared to previous period
  isCurrentUser: boolean;
}

export interface SetterLeaderboardItem {
  id: string;
  name: string;
  avatar_url: string | null;
  bookings: number;
  shows: number;
  showRate: number;
  conversions: number;
  rank: number;
  trend: 'up' | 'down' | 'same';
  isCurrentUser: boolean;
}

// ============================================
// Resources Types
// ============================================

export type ResourceCategory = 'scripts' | 'objections' | 'pricing' | 'training';

export interface SalesResource {
  id: string;
  category: ResourceCategory;
  title: string;
  url: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

// ============================================
// Call Outcome Types (for dialog)
// ============================================

export type CallOutcome =
  | 'closed'
  | 'follow_up_zoom'
  | 'send_proposal'
  | 'needs_nurture'
  | 'no_show'
  | 'lost';

export interface CallOutcomeData {
  outcome: CallOutcome;
  leadId: string;
  callLogId?: string;
  notes?: string;
  // For follow_up_zoom
  followUpDate?: string;
  // For send_proposal
  proposalNotes?: string;
}

// ============================================
// Leads to Work Types (Setter Mode)
// ============================================

export interface LeadToWork {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  created_at: string;
  last_contacted_at?: string | null;
  last_contact_method?: string | null;
  assigned_setter_id: string | null;
}

// ============================================
// Sales Floor Dashboard Data
// ============================================

export interface SalesFloorData {
  viewMode: SalesFloorViewMode;
  nextZoom: NextZoomData | null;
  upcomingCalls: UpcomingCall[];
  personalStats: PersonalStats;
  followUpTasks: FollowUpTask[];
  leaderboard: CloserLeaderboardItem[] | SetterLeaderboardItem[];
  resources: SalesResource[];
  // Setter-specific
  leadsToWork?: LeadToWork[];
}
