'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ListTodo,
  Calendar,
  Phone,
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  User,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';
import type { FollowUpTask, FollowUpOutcomeType } from '@/types/sales-floor';
import { updateFollowUpTask, rescheduleFollowUpTask } from '@/lib/actions/sales-floor';

interface FollowUpQueueProps {
  tasks: FollowUpTask[];
  onTaskUpdated?: () => void;
}

const outcomeLabels: Record<FollowUpOutcomeType, { label: string; color: string; icon: React.ElementType }> = {
  follow_up_zoom: { label: 'Schedule Follow-up', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: Calendar },
  send_proposal: { label: 'Send Proposal', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: Send },
  needs_nurture: { label: 'Needs Nurture', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', icon: RefreshCw },
  no_show: { label: 'No Show', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', icon: XCircle },
  lost: { label: 'Lost', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: XCircle },
};

function TaskItem({
  task,
  onComplete,
  onReschedule,
}: {
  task: FollowUpTask;
  onComplete: (taskId: string) => void;
  onReschedule: (task: FollowUpTask) => void;
}) {
  const outcome = outcomeLabels[task.outcome_type];
  const OutcomeIcon = outcome.icon;
  const isOverdue = task.callback_date && isPast(new Date(task.callback_date));
  const leadName = task.lead
    ? `${task.lead.first_name} ${task.lead.last_name}`
    : 'Unknown Lead';

  return (
    <div className={`p-3 rounded-xl border transition-all duration-300 ${isOverdue
        ? 'bg-red-950/40 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
      }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Outcome Badge */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-xs ${outcome.color}`}>
              <OutcomeIcon className="w-3 h-3 mr-1" />
              {outcome.label}
            </Badge>
            {isOverdue && (
              <Badge variant="outline" className="text-xs text-red-400 bg-red-500/10 border-red-500/30">
                Overdue
              </Badge>
            )}
          </div>

          {/* Lead Name */}
          <div className="flex items-center gap-2 mb-1">
            <User className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-sm font-medium text-white">{leadName}</span>
            {task.lead && (
              <Link
                href={`/leads/${task.lead.id}`}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          {/* Contact Info */}
          {task.lead && (
            <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
              {task.lead.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {task.lead.email}
                </span>
              )}
              {task.lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {task.lead.phone}
                </span>
              )}
            </div>
          )}

          {/* Callback Date */}
          {task.callback_date && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>
                {format(new Date(task.callback_date), 'MMM d, h:mm a')}
                {' • '}
                {formatDistanceToNow(new Date(task.callback_date), { addSuffix: true })}
              </span>
            </div>
          )}

          {/* Notes */}
          {task.notes && (
            <p className="text-xs text-gray-400 mt-2 line-clamp-2">{task.notes}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-950/90 backdrop-blur-xl border-white/10">
              <DropdownMenuItem
                onClick={() => onComplete(task.id)}
                className="text-emerald-400 focus:text-emerald-400"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onReschedule(task)}
                className="text-blue-400 focus:text-blue-400"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Reschedule
              </DropdownMenuItem>
              {task.lead && (
                <DropdownMenuItem asChild>
                  <Link href={`/leads/${task.lead.id}`} className="text-gray-300">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Lead
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export function FollowUpQueue({ tasks, onTaskUpdated }: FollowUpQueueProps) {
  const [rescheduleTask, setRescheduleTask] = useState<FollowUpTask | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group tasks by outcome type
  const urgentTasks = tasks.filter(t =>
    t.callback_date && isPast(new Date(t.callback_date))
  );
  const upcomingTasks = tasks.filter(t =>
    !t.callback_date || !isPast(new Date(t.callback_date))
  );

  const handleComplete = async (taskId: string) => {
    setIsSubmitting(true);
    const result = await updateFollowUpTask(taskId, 'completed');
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Task marked as complete');
      onTaskUpdated?.();
    } else {
      toast.error(result.error || 'Failed to complete task');
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleTask || !rescheduleDate) return;

    setIsSubmitting(true);
    const result = await rescheduleFollowUpTask(
      rescheduleTask.id,
      new Date(rescheduleDate).toISOString(),
      rescheduleNotes || undefined
    );
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Task rescheduled');
      setRescheduleTask(null);
      setRescheduleDate('');
      setRescheduleNotes('');
      onTaskUpdated?.();
    } else {
      toast.error(result.error || 'Failed to reschedule task');
    }
  };

  return (
    <>
      <Card className="bg-zinc-900/40 backdrop-blur-xl border-white/5 shadow-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-white flex items-center justify-between">
            <div className="flex items-center">
              <ListTodo className="w-5 h-5 mr-2 text-yellow-400" />
              Follow-Up Queue
            </div>
            {tasks.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-600 mb-3" />
              <p className="text-gray-400 text-sm">All caught up!</p>
              <p className="text-gray-500 text-xs mt-1">No pending follow-ups</p>
            </div>
          ) : (
            <>
              {/* Overdue Tasks */}
              {urgentTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                      Overdue
                    </span>
                    <span className="text-xs text-gray-500">
                      {urgentTasks.length} task{urgentTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {urgentTasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onComplete={handleComplete}
                        onReschedule={setRescheduleTask}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Tasks */}
              {upcomingTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Upcoming
                    </span>
                    <span className="text-xs text-gray-500">
                      {upcomingTasks.length} task{upcomingTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {upcomingTasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onComplete={handleComplete}
                        onReschedule={setRescheduleTask}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleTask} onOpenChange={(open) => !open && setRescheduleTask(null)}>
        <DialogContent className="bg-zinc-950/90 backdrop-blur-xl border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Reschedule Follow-Up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Date & Time</Label>
              <Input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="bg-gray-900 border-gray-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={rescheduleNotes}
                onChange={(e) => setRescheduleNotes(e.target.value)}
                placeholder="Add notes about the reschedule..."
                className="bg-gray-900 border-gray-700"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRescheduleTask(null)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleDate || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Saving...' : 'Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
