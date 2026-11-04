import { CoachingSession } from "@/types/coaching-session";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import {
  useCoachingSessionList,
  useCoachingSessionMutation,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { SessionWrite, sessionWriteFailure } from "@/lib/api/coaching-session-errors";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { calendarDayOf, getBrowserTimezone, pickedDayIn } from "@/lib/timezone-utils";
import { toSessionDate } from "@/lib/session-window";
import { toast } from "@/lib/toast";
import { sessionUpdatedMessage } from "@/components/ui/dashboard/session-change-message";
import { CoachingSessionDurationInput } from "@/components/ui/coaching-sessions/coaching-session-duration-input";
import { validateDurationMinutes } from "@/types/coaching-session-duration";

interface CoachingSessionFormProps {
  existingSession: CoachingSession;
  onOpenChange: (open: boolean) => void;
}

export default function CoachingSessionForm({
  existingSession,
  onOpenChange,
}: CoachingSessionFormProps) {
  const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore(
    (state) => state
  );
  const { userSession } = useAuthStore((state) => state);
  const { currentOrganizationId } = useCurrentOrganization();
  const fromDate = DateTime.now().minus({ month: 1 });
  const toDate = DateTime.now().plus({ month: 1 });
  const { refresh } = useCoachingSessionList(
    currentCoachingRelationshipId,
    fromDate,
    toDate
  );
  const router = useRouter();
  const { update } = useCoachingSessionMutation();
  const { relationships } = useCoachingRelationshipList(currentOrganizationId ?? "");

  const userTimezone = userSession?.timezone || getBrowserTimezone();
  // Stored UTC time, shown in the user's timezone for editing.
  const existingStart = DateTime.fromISO(existingSession.date, { zone: "utc" }).setZone(userTimezone);

  // State for preventing duplicate submissions (Issue #207)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionDate, setSessionDate] = useState<Date | undefined>(() => calendarDayOf(existingStart));
  const [sessionTime, setSessionTime] = useState<string>(() => existingStart.toFormat("HH:mm"));
  const [durationMinutes, setDurationMinutes] = useState<number>(existingSession.duration_minutes);

  const handleUpdateSession = async (dateTime: string) => {
    await update(existingSession.id, {
      ...existingSession,
      date: dateTime,
      duration_minutes: durationMinutes,
      updated_at: DateTime.now().toUTC(),
    });
    toast.success(
      sessionUpdatedMessage({ ...existingSession, date: dateTime }, relationships, userTimezone)
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions (Issue #207)
    if (isSubmitting) return;
    if (!sessionDate || !sessionTime) return;

    setIsSubmitting(true);

    const [hours, minutes] = sessionTime.split(":").map(Number);
    const localDateTime = pickedDayIn(sessionDate, userTimezone).set({ hour: hours, minute: minutes });

    try {
      await handleUpdateSession(toSessionDate(localDateTime));
      refresh();
    } catch (error) {
      const failure = sessionWriteFailure(error, SessionWrite.Update);
      switch (failure.kind) {
        case "reconnect":
          toast.error(failure.message);
          router.push("/settings/integrations");
          break;
        case "toast":
          toast.error(failure.message);
          console.error("Failed to update coaching session:", error);
          break;
        case "unexpected":
          console.error("Failed to update coaching session:", error);
          break;
        default: {
          const _exhaustive: never = failure;
          throw new Error(`Unhandled session write failure: ${JSON.stringify(_exhaustive)}`);
        }
      }
    } finally {
      setIsSubmitting(false);
      onOpenChange(false);
    }
  };

  const canSubmit =
    !!sessionDate &&
    !!sessionTime &&
    !isSubmitting &&
    validateDurationMinutes(durationMinutes).isOk();

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="session-date">Session Date</Label>
          <Calendar
            mode="single"
            selected={sessionDate}
            defaultMonth={sessionDate}
            onSelect={(date) => setSessionDate(date)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="session-time">Session Time</Label>
            <Input
              type="time"
              id="session-time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-duration">Duration</Label>
            <CoachingSessionDurationInput
              id="session-duration"
              value={durationMinutes}
              onChange={setDurationMinutes}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={!canSubmit} className="justify-self-start">
        {isSubmitting && <Spinner className="mr-2" />}
        Update Session
      </Button>
    </form>
  );
}
