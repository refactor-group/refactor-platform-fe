"use client";

import { useMemo, useState, type FormEvent } from "react";
import { DateTime } from "ts-luxon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CoachingSessionDurationInput } from "@/components/ui/coaching-sessions/coaching-session-duration-input";
import { RecurrenceFields } from "@/components/ui/dashboard/recurrence-fields";
import { useRecurrenceState } from "@/lib/hooks/use-recurrence-state";
import { useCoachingSessionSeriesMutation } from "@/lib/api/coaching-session-series";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import {
  EntityApiError,
  PERMISSION_DENIED_MESSAGE,
  isForbiddenError,
} from "@/types/entity-api-error";
import {
  CoachingSessionSeries,
  seriesRecurrenceToEnd,
} from "@/types/coaching-session-series";
import {
  CreateRecurringSessionRequest,
  Recurrence,
  Weekday,
  recurrenceToPayload,
  untilDateToUtcDateTime,
  validateRecurrence,
  weekdayFromLuxon,
} from "@/types/recurrence";
import { validateDurationMinutes } from "@/types/coaching-session-duration";

export interface RescheduleSeriesDialogProps {
  series: CoachingSessionSeries | null;
  onClose: () => void;
  onRescheduled?: () => void;
}

export function RescheduleSeriesDialog({
  series,
  onClose,
  onRescheduled,
}: RescheduleSeriesDialogProps) {
  return (
    <Dialog
      open={series !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reschedule Coaching Session Series</DialogTitle>
          <DialogDescription>
            Update future coaching sessions in this series.
          </DialogDescription>
        </DialogHeader>
        {series && (
          <RescheduleSeriesForm
            key={series.id}
            series={series}
            onClose={onClose}
            onRescheduled={onRescheduled}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface RescheduleSeriesFormProps {
  series: CoachingSessionSeries;
  onClose: () => void;
  onRescheduled?: () => void;
}

function RescheduleSeriesForm({
  series,
  onClose,
  onRescheduled,
}: RescheduleSeriesFormProps) {
  const { userSession } = useAuthStore((state) => state);
  const userTimezone = userSession?.timezone || getBrowserTimezone();
  const { update } = useCoachingSessionSeriesMutation(userTimezone);

  // The stored start is a naive UTC ISO string; interpret as UTC, then show
  // it in the user's timezone for editing (mirrors the create/edit form).
  const startLocal = DateTime.fromISO(series.rule.start_at, {
    zone: "utc",
  }).setZone(userTimezone);

  const [sessionDate, setSessionDate] = useState<Date | undefined>(
    startLocal.toJSDate()
  );
  const [sessionTime, setSessionTime] = useState<string>(
    startLocal.toFormat("HH:mm")
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    series.rule.duration_minutes
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startWeekday = useMemo<Weekday | null>(() => {
    if (!sessionDate) return null;
    const local = DateTime.fromJSDate(sessionDate).setZone(userTimezone);
    return weekdayFromLuxon(local.weekday);
  }, [sessionDate, userTimezone]);

  const {
    frequency,
    setFrequency,
    interval,
    setInterval,
    byWeekdays,
    setByWeekdays,
    end,
    setEnd,
  } = useRecurrenceState({
    enabled: true,
    startWeekday,
    timezone: userTimezone,
    init: {
      frequency: series.rule.recurrence.frequency,
      interval: series.rule.recurrence.interval,
      byWeekdays: series.rule.recurrence.by_weekdays ?? [],
      end: seriesRecurrenceToEnd(series.rule.recurrence),
    },
  });

  const recurrenceError = useMemo<string | null>(() => {
    const start = sessionDate
      ? DateTime.fromJSDate(sessionDate).setZone(userTimezone)
      : null;
    return validateRecurrence({
      frequency,
      interval,
      byWeekdays,
      end,
      start,
      startWeekday,
      timezone: userTimezone,
    });
  }, [
    interval,
    end,
    frequency,
    byWeekdays,
    startWeekday,
    sessionDate,
    userTimezone,
  ]);

  const canSubmit =
    !!sessionDate &&
    !!sessionTime &&
    !isSubmitting &&
    !recurrenceError &&
    validateDurationMinutes(durationMinutes).isOk();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !sessionDate || !sessionTime) return;

    setIsSubmitting(true);

    const [hours, minutes] = sessionTime.split(":").map(Number);
    const utcDateTime = DateTime.fromJSDate(sessionDate)
      .setZone(userTimezone)
      .set({ hour: hours, minute: minutes })
      .toUTC()
      .toFormat("yyyy-MM-dd'T'HH:mm:ss");

    const recurrence: Recurrence = recurrenceToPayload(
      frequency,
      interval,
      byWeekdays,
      end
    );
    if (recurrence.until) {
      recurrence.until = untilDateToUtcDateTime(recurrence.until, userTimezone);
    }
    const payload: CreateRecurringSessionRequest = {
      coaching_relationship_id: series.coaching_relationship_id,
      start_at: utcDateTime,
      recurrence,
      duration_minutes: durationMinutes,
    };

    try {
      await update(series.id, payload);
      toast.success("Series rescheduled. Future sessions were updated.");
      onRescheduled?.();
      onClose();
    } catch (error) {
      let message: string;
      if (isForbiddenError(error)) {
        message = PERMISSION_DENIED_MESSAGE;
      } else if (error instanceof EntityApiError && error.status === 422) {
        message = "Couldn't reschedule the series. Please review the form and try again.";
      } else {
        message = "Failed to reschedule the series. Please try again.";
      }
      toast.error(message);
      console.error("Failed to reschedule coaching session series:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 sm:grid-cols-2 sm:items-start"
    >
      <div className="space-y-2">
        <Label htmlFor="reschedule-date">First Session Date</Label>
        <Calendar
          mode="single"
          selected={sessionDate}
          onSelect={(date) => setSessionDate(date)}
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="reschedule-time">First Session Time</Label>
            <Input
              type="time"
              id="reschedule-time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reschedule-duration">Duration</Label>
            <CoachingSessionDurationInput
              id="reschedule-duration"
              value={durationMinutes}
              onChange={setDurationMinutes}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <RecurrenceFields
          frequency={frequency}
          onFrequencyChange={setFrequency}
          interval={interval}
          onIntervalChange={setInterval}
          byWeekdays={byWeekdays}
          onByWeekdaysChange={setByWeekdays}
          end={end}
          onEndChange={setEnd}
          startWeekday={startWeekday}
          startDate={
            sessionDate
              ? DateTime.fromJSDate(sessionDate).setZone(userTimezone)
              : null
          }
          timezone={userTimezone}
          disabled={isSubmitting}
          error={recurrenceError}
        />
      </div>

      <Button
        type="submit"
        disabled={!canSubmit}
        className="justify-self-start sm:col-span-2"
      >
        {isSubmitting && <Spinner className="mr-2" />}
        Reschedule Sessions
      </Button>
    </form>
  );
}
