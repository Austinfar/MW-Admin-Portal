'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  Target,
  Phone,
  TrendingUp,
  Calendar,
  Users,
  Percent,
  Banknote,
} from 'lucide-react';
import type { CloserStats, SetterStats, SalesFloorViewMode } from '@/types/sales-floor';

interface MyStatsPanelProps {
  mode: SalesFloorViewMode;
  closerStats?: CloserStats;
  setterStats?: SetterStats;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor = 'text-gray-400',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-900/30 rounded-lg">
      <div className={`p-2 rounded-md bg-gray-800 ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
        {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
      </div>
    </div>
  );
}

function QuotaProgressBar({
  label,
  current,
  target,
  percentage,
  color = 'bg-emerald-500',
}: {
  label: string;
  current: number;
  target: number | null;
  percentage: number;
  color?: string;
}) {
  if (!target) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300">
          {typeof current === 'number' && current >= 1000
            ? `$${(current / 1000).toFixed(1)}k`
            : current}{' '}
          / {typeof target === 'number' && target >= 1000
            ? `$${(target / 1000).toFixed(1)}k`
            : target}
        </span>
      </div>
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <p className="text-right text-xs text-gray-500">{Math.round(percentage)}% of quota</p>
    </div>
  );
}

export function MyStatsPanel({ mode, closerStats, setterStats }: MyStatsPanelProps) {
  if (mode === 'closer' && closerStats) {
    return (
      <Card className="bg-[#1A1A1A] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" />
            My Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={DollarSign}
              label="Revenue"
              value={`$${closerStats.revenue.toLocaleString()}`}
              iconColor="text-emerald-400"
            />
            <StatCard
              icon={Target}
              label="Deals Closed"
              value={closerStats.deals}
              iconColor="text-blue-400"
            />
            <StatCard
              icon={Phone}
              label="Calls Taken"
              value={closerStats.callsTaken}
              iconColor="text-purple-400"
            />
            <StatCard
              icon={Percent}
              label="Close Rate"
              value={`${closerStats.closeRate}%`}
              iconColor="text-yellow-400"
            />
          </div>

          {/* Quota Progress */}
          {(closerStats.quotaProgress.revenue.target || closerStats.quotaProgress.deals.target) && (
            <div className="space-y-3 pt-2 border-t border-gray-800">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Quota Progress</p>
              <QuotaProgressBar
                label="Revenue"
                current={closerStats.quotaProgress.revenue.current}
                target={closerStats.quotaProgress.revenue.target}
                percentage={closerStats.quotaProgress.revenue.percentage}
                color="bg-emerald-500"
              />
              <QuotaProgressBar
                label="Deals"
                current={closerStats.quotaProgress.deals.current}
                target={closerStats.quotaProgress.deals.target}
                percentage={closerStats.quotaProgress.deals.percentage}
                color="bg-blue-500"
              />
            </div>
          )}

          {/* Pending Commissions */}
          {closerStats.pendingCommissions > 0 && (
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">Pending Commissions</span>
              </div>
              <span className="text-lg font-bold text-emerald-400">
                ${closerStats.pendingCommissions.toLocaleString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (mode === 'setter' && setterStats) {
    return (
      <Card className="bg-[#1A1A1A] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-400" />
            My Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Calendar}
              label="Bookings"
              value={setterStats.bookings}
              iconColor="text-blue-400"
            />
            <StatCard
              icon={Users}
              label="Shows"
              value={setterStats.shows}
              iconColor="text-purple-400"
            />
            <StatCard
              icon={Percent}
              label="Show Rate"
              value={`${setterStats.showRate}%`}
              iconColor="text-yellow-400"
            />
            <StatCard
              icon={Target}
              label="Conversions"
              value={setterStats.conversions}
              subValue={`${setterStats.conversionRate}% rate`}
              iconColor="text-emerald-400"
            />
          </div>

          {/* Quota Progress */}
          {setterStats.quotaProgress.bookings?.target && (
            <div className="space-y-3 pt-2 border-t border-gray-800">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Quota Progress</p>
              <QuotaProgressBar
                label="Bookings"
                current={setterStats.quotaProgress.bookings.current}
                target={setterStats.quotaProgress.bookings.target}
                percentage={setterStats.quotaProgress.bookings.percentage}
                color="bg-blue-500"
              />
            </div>
          )}

          {/* Pending Commissions */}
          {setterStats.pendingCommissions > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">Pending Commissions</span>
              </div>
              <span className="text-lg font-bold text-blue-400">
                ${setterStats.pendingCommissions.toLocaleString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fallback loading state
  return (
    <Card className="bg-[#1A1A1A] border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-white flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-gray-400" />
          My Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-800 rounded-lg" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
