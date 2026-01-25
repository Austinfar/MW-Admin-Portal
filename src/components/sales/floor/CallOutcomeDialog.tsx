'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CheckCircle,
  Calendar,
  Send,
  RefreshCw,
  UserX,
  XCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createFollowUpTask, logCallOutcomeAsConversion } from '@/lib/actions/sales-floor';
import type { CallOutcome, FollowUpOutcomeType } from '@/types/sales-floor';

interface CallOutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  callLogId?: string;
  closerId: string;
  onOutcomeLogged?: (outcome: CallOutcome) => void;
}

const outcomeOptions: {
  value: CallOutcome;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: 'closed',
    label: 'Closed!',
    description: 'Lead signed up and became a client',
    icon: CheckCircle,
    color: 'text-emerald-400 border-emerald-500',
  },
  {
    value: 'follow_up_zoom',
    label: 'Schedule Follow-up',
    description: 'Need another call to close the deal',
    icon: Calendar,
    color: 'text-blue-400 border-blue-500',
  },
  {
    value: 'send_proposal',
    label: 'Send Proposal',
    description: 'Lead wants to review pricing/details',
    icon: Send,
    color: 'text-purple-400 border-purple-500',
  },
  {
    value: 'needs_nurture',
    label: 'Needs Nurture',
    description: 'Not ready yet, hand back to setter',
    icon: RefreshCw,
    color: 'text-yellow-400 border-yellow-500',
  },
  {
    value: 'no_show',
    label: 'No Show',
    description: "Lead didn't attend the call",
    icon: UserX,
    color: 'text-orange-400 border-orange-500',
  },
  {
    value: 'lost',
    label: 'Not Qualified',
    description: 'Lead is not a good fit',
    icon: XCircle,
    color: 'text-red-400 border-red-500',
  },
];

export function CallOutcomeDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  callLogId,
  closerId,
  onOutcomeLogged,
}: CallOutcomeDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsFollowUpDate = selectedOutcome === 'follow_up_zoom' || selectedOutcome === 'no_show';
  const needsNotes = selectedOutcome && selectedOutcome !== 'closed';

  const handleSubmit = async () => {
    if (!selectedOutcome) return;

    // If closed, update lead status to 'Closed Won' and await payment
    if (selectedOutcome === 'closed') {
      setIsSubmitting(true);
      const result = await logCallOutcomeAsConversion({
        leadId,
        closerId,
        notes: notes || undefined,
      });
      setIsSubmitting(false);

      if (result.success) {
        toast.success('Congratulations on the close! Lead marked as Closed Won - send payment link to complete conversion.');
        onOutcomeLogged?.(selectedOutcome);
        resetAndClose();
      } else {
        toast.error(result.error || 'Failed to log close');
      }
      return;
    }

    // Map CallOutcome to FollowUpOutcomeType
    const outcomeTypeMap: Partial<Record<CallOutcome, FollowUpOutcomeType>> = {
      follow_up_zoom: 'follow_up_zoom',
      send_proposal: 'send_proposal',
      needs_nurture: 'needs_nurture',
      no_show: 'no_show',
      lost: 'lost',
    };

    const outcomeType = outcomeTypeMap[selectedOutcome];
    if (!outcomeType) return;

    setIsSubmitting(true);

    const result = await createFollowUpTask({
      leadId,
      assignedTo: closerId,
      outcomeType,
      callbackDate: followUpDate ? new Date(followUpDate).toISOString() : undefined,
      notes: notes || undefined,
      sourceCallLogId: callLogId,
    });

    setIsSubmitting(false);

    if (result.success) {
      const successMessages: Record<FollowUpOutcomeType, string> = {
        follow_up_zoom: 'Follow-up call scheduled',
        send_proposal: 'Proposal task created',
        needs_nurture: 'Lead handed back for nurturing',
        no_show: 'No-show logged, reschedule task created',
        lost: 'Lead marked as not qualified',
      };
      toast.success(successMessages[outcomeType]);
      onOutcomeLogged?.(selectedOutcome);
      resetAndClose();
    } else {
      toast.error(result.error || 'Failed to log outcome');
    }
  };

  const resetAndClose = () => {
    setSelectedOutcome(null);
    setFollowUpDate('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1A1A1A] border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Log Call Outcome</DialogTitle>
          <DialogDescription className="text-gray-400">
            How did the call with <span className="text-white font-medium">{leadName}</span> go?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Outcome Selection */}
          <RadioGroup
            value={selectedOutcome || ''}
            onValueChange={(value: string) => setSelectedOutcome(value as CallOutcome)}
            className="space-y-2"
          >
            {outcomeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedOutcome === option.value;

              return (
                <div key={option.value}>
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? `bg-gray-800 ${option.color}`
                        : 'bg-gray-900/50 border-gray-700 hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? option.color.split(' ')[0] : 'text-gray-500'}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-500">{option.description}</p>
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {/* Follow-up Date (conditional) */}
          {needsFollowUpDate && (
            <div className="space-y-2 pt-2 border-t border-gray-800">
              <Label>
                {selectedOutcome === 'follow_up_zoom' ? 'Follow-up Call Date' : 'Reschedule Date'}
              </Label>
              <Input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="bg-gray-900 border-gray-700"
              />
            </div>
          )}

          {/* Notes (conditional) */}
          {needsNotes && (
            <div className="space-y-2">
              <Label>Notes {selectedOutcome !== 'lost' && '(optional)'}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  selectedOutcome === 'lost'
                    ? 'Why was this lead not qualified?'
                    : 'Add any relevant notes...'
                }
                className="bg-gray-900 border-gray-700 min-h-[80px]"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={resetAndClose}
            className="border-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedOutcome || isSubmitting || (needsFollowUpDate && !followUpDate)}
            className={
              selectedOutcome === 'closed'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : selectedOutcome === 'closed' ? (
              'Mark as Closed'
            ) : (
              'Log Outcome'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
