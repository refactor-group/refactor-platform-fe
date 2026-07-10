import { CoachingSession } from "@/types/coaching-session";
import {
  getRelationshipsAsCoach,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/components/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import {
  useCoachingSessionList,
  useCoachingSessionMutation,
} from "@/lib/api/coaching-sessions";
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { organizationArchivedMessage } from "@/lib/api/organization-errors";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useState, useMemo, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { defaultCoachingSession } from "@/types/coaching-session";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { EntityApiError, PERMISSION_DENIED_MESSAGE, isForbiddenError } from "@/types/entity-api-error";
import { toast } from "sonner";
import { Provider } from "@/types/provider";
import {
  CreateRecurringSessionRequest,
  Recurrence,
  Weekday,
  recurrenceToPayload,
  untilDateToUtcDateTime,
  validateRecurrence,
  weekdayFromLuxon,
} from "@/types/recurrence";
import { CoachingSessionDurationInput } from "@/components/ui/coaching-sessions/coaching-session-duration-input";
import { RecurrenceFields } from "@/components/ui/dashboard/recurrence-fields";
import { useRecurrenceState } from "@/lib/hooks/use-recurrence-state";
import {
  isDurationValidationError,
  validateDurationMinutes,
} from "@/types/coaching-session-duration";

export type CoachingSessionFormMode = "create" | "update";

interface CoachingSessionFormProps {
  existingSession?: CoachingSession;
  mode: CoachingSessionFormMode;
  onOpenChange: (open: boolean) => void;
  defaultDurationMinutes: number;
}


export default function CoachingSessionForm({
  existingSession,
  mode,
  onOpenChange,
  defaultDurationMinutes,
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
  const { create: createCoachingSession, update } =
    useCoachingSessionMutation();

  // Fetch relationships to populate coachee selector (only needed in create mode)
  const { relationships, isLoading: isLoadingRelationships } =
    useCoachingRelationshipList(currentOrganizationId ?? "");
  const { connections } = useOAuthConnections();

  // Filter to relationships where current user is the coach, sorted alphabetically by coachee name
  const coacheeRelationships = useMemo(() => {
    if (!userSession?.id || !relationships) return [];
    const asCoach = getRelationshipsAsCoach(userSession.id, relationships);
    return sortRelationshipsByParticipantName(asCoach, userSession.id);
  }, [relationships, userSession?.id]);

  // State for selected coachee in create mode
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>(
    () => existingSession?.coaching_relationship_id ?? currentCoachingRelationshipId ?? ""
  );

  const activeProvider = connections?.[0]?.provider ?? null;

  // State for preventing duplicate submissions (Issue #207)
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sessionDate, setSessionDate] = useState<Date | undefined>(() => {
    if (!existingSession) return undefined;
    // Convert stored UTC time back to user's local timezone for editing
    const userTimezone = userSession?.timezone || getBrowserTimezone();
    const utcDateTime = DateTime.fromISO(existingSession.date, { zone: 'utc' });
    const localDateTime = utcDateTime.setZone(userTimezone);
    return localDateTime.toJSDate();
  });

  const [sessionTime, setSessionTime] = useState<string>(() => {
    if (!existingSession) return "";
    // Convert stored UTC time back to user's local timezone for editing
    const userTimezone = userSession?.timezone || getBrowserTimezone();
    const utcDateTime = DateTime.fromISO(existingSession.date, { zone: 'utc' });
    const localDateTime = utcDateTime.setZone(userTimezone);
    return localDateTime.toFormat("HH:mm");
  });

  const [durationMinutes, setDurationMinutes] = useState<number>(
    () => existingSession?.duration_minutes ?? defaultDurationMinutes
  );

  // Tracks whether the coach has manually edited the duration field this
  // session. Set on any user-driven change; checked by the sync effect so
  // that the cold-load default-load doesn't clobber deliberate edits.
  const hasUserEditedDurationRef = useRef(false);

  const handleDurationChange = useCallback((next: number) => {
    hasUserEditedDurationRef.current = true;
    setDurationMinutes(next);
  }, []);

  // Sync with the coach's stored default once user data loads. Only in create
  // mode (update mode pre-fills from the existing session), and only while the
  // coach hasn't manually edited the field yet — otherwise a cold-load fetch
  // resolving mid-edit would silently overwrite a deliberate value.
  useEffect(() => {
    if (mode !== "create") return;
    if (hasUserEditedDurationRef.current) return;
    setDurationMinutes(defaultDurationMinutes);
  }, [defaultDurationMinutes, mode]);

  // ── Recurrence state (create mode only) ─────────────────────────────
  const [isRecurring, setIsRecurring] = useState(false);

  const userTimezone = userSession?.timezone || getBrowserTimezone();

  // The weekday of the start date (in the user's timezone). When recurring
  // is on with weekly/biweekly + by_weekdays, the backend requires this
  // weekday to be included — otherwise 422. The hook auto-seeds it.
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
    reset: resetRecurrence,
  } = useRecurrenceState({
    enabled: isRecurring,
    startWeekday,
    timezone: userTimezone,
  });

  const showTwoCol = mode === "create";

  const resetForm = () => {
    setSessionDate(undefined);
    setSessionTime("");
    setDurationMinutes(
      existingSession?.duration_minutes ?? defaultDurationMinutes
    );
    hasUserEditedDurationRef.current = false;
    setSelectedRelationshipId(currentCoachingRelationshipId ?? "");
    setIsRecurring(false);
    resetRecurrence();
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const handleCreateSession = async (dateTime: string) => {
    // Use selected relationship for create mode
    const relationshipId = selectedRelationshipId || currentCoachingRelationshipId;
    if (!relationshipId) return;

    const newCoachingSession: CoachingSession = {
      ...defaultCoachingSession(),
      coaching_relationship_id: relationshipId,
      date: dateTime,
      duration_minutes: durationMinutes,
      provider: activeProvider ? activeProvider as Provider : undefined
    };
    await createCoachingSession(newCoachingSession);
  };

  const handleCreateRecurringSession = async (dateTime: string) => {
    const relationshipId = selectedRelationshipId || currentCoachingRelationshipId;
    if (!relationshipId) return;

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
      coaching_relationship_id: relationshipId,
      start_at: dateTime,
      recurrence,
      duration_minutes: durationMinutes,
    };
    const created = await CoachingSessionSeriesApi.create(payload, userTimezone);
    const count = created.coaching_sessions.length;
    toast.success(
      `Created ${count} recurring session${count === 1 ? "" : "s"}.`
    );
  };

  const handleUpdateSession = async (dateTime: string) => {
    if (!existingSession) return;
    await update(existingSession.id, {
      ...existingSession,
      date: dateTime,
      duration_minutes: durationMinutes,
      updated_at: DateTime.now().toUTC(),
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions (Issue #207)
    if (isSubmitting) return;

    // Validate required fields
    if (!sessionDate || !sessionTime) return;

    // For create mode, require a coachee to be selected
    const relationshipId = mode === "create"
      ? (selectedRelationshipId || currentCoachingRelationshipId)
      : existingSession?.coaching_relationship_id;
    if (mode === "create" && !relationshipId) return;

    setIsSubmitting(true);

    const [hours, minutes] = sessionTime.split(":").map(Number);

    // Create datetime in user's timezone, then convert to UTC for storage
    const userTimezone = userSession?.timezone || getBrowserTimezone();
    const localDateTime = DateTime.fromJSDate(sessionDate)
      .setZone(userTimezone)
      .set({ hour: hours, minute: minutes });

    // Convert to UTC for consistent storage
    const utcDateTime = localDateTime.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss");

    const handler =
      mode === "update"
        ? handleUpdateSession
        : isRecurring
          ? handleCreateRecurringSession
          : handleCreateSession;

    try {
      await handler(utcDateTime);
      refresh();
    } catch (error) {
      const archivedMessage = organizationArchivedMessage(error);
      if (!(error instanceof EntityApiError)) {
        console.error(`Failed to ${mode} coaching session:`, error);
      } else if (error.status === 409 && error.data?.error === "oauth_token_revoked") {
        toast.error("Your Google Meet integration has been disconnected. Please reconnect in Settings.");
        router.push("/settings/integrations");
      } else if (archivedMessage !== null) {
        toast.error(archivedMessage);
        console.error(`Failed to ${mode} coaching session:`, error);
      } else {
        let message: string;
        if (isDurationValidationError(error)) {
          message = error.data.message;
        } else if (error.isNetworkError()) {
          message = "Could not connect to server. Please check your internet connection.";
        } else if (error.status === 502) {
          message = "Could not create Google Meet link due to a connection error. Please try again.";
        } else if (error.status === 422) {
          message = `Couldn't ${mode === "update" ? "update" : "create"} ${isRecurring ? "the recurring sessions" : "the session"}. Please review the form and try again.`;
        } else if (isForbiddenError(error)) {
          message = PERMISSION_DENIED_MESSAGE;
        } else {
          message = `Failed to ${mode} coaching session. Please try again.`;
        }
        toast.error(message);
        console.error(`Failed to ${mode} coaching session:`, error);
      }
    } finally {
      resetForm();
    }
  };

  // Client-side guards mirroring the backend's field rules; surfaced as a
  // single message and used to gate submission.
  const recurrenceError = useMemo<string | null>(() => {
    if (!isRecurring) return null;
    const userTimezone = userSession?.timezone || getBrowserTimezone();
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
    isRecurring,
    interval,
    end,
    frequency,
    byWeekdays,
    startWeekday,
    sessionDate,
    userSession?.timezone,
  ]);

  // Determine if form can be submitted. A coachee is only required in create
  // mode; update mode inherits it from the existing session.
  const hasCoachee =
    mode !== "create" ||
    !!(selectedRelationshipId || currentCoachingRelationshipId);

  const canSubmit =
    !!sessionDate &&
    !!sessionTime &&
    !isSubmitting &&
    !recurrenceError &&
    hasCoachee &&
    validateDurationMinutes(durationMinutes).isOk();

  const buttonText =
    mode === "update"
      ? "Update Session"
      : isRecurring
        ? "Create Recurring Sessions"
        : "Create Session";

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("grid gap-6", showTwoCol && "sm:grid-cols-2 sm:items-start")}
    >
      {/* Coachee selector - only shown in create mode */}
      {mode === "create" && (
        <div className={cn("space-y-2", showTwoCol && "sm:col-span-2")}>
          <Label htmlFor="coachee-select">Select Coachee</Label>
          <Select
            value={selectedRelationshipId}
            onValueChange={setSelectedRelationshipId}
            disabled={isLoadingRelationships || isSubmitting}
          >
            <SelectTrigger id="coachee-select">
              <SelectValue placeholder="Select a coachee" />
            </SelectTrigger>
            <SelectContent>
              {coacheeRelationships.length === 0 ? (
                <SelectItem value="_no_coachees" disabled>
                  No coachees available
                </SelectItem>
              ) : (
                coacheeRelationships.map((rel) => (
                  <SelectItem key={rel.id} value={rel.id}>
                    {rel.coachee_first_name} {rel.coachee_last_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="session-date">Session Date</Label>
          <Calendar
            mode="single"
            selected={sessionDate}
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
              onChange={handleDurationChange}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Recurring section — create mode only. Editing a recurrence rule
          is a different operation that isn't supported by this dialog. */}
      {mode === "create" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="recurring-switch" className="cursor-pointer">
              Repeats
            </Label>
            <Switch
              id="recurring-switch"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
              disabled={isSubmitting}
            />
          </div>

          {isRecurring && (
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
          )}
        </div>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className={cn("justify-self-start", showTwoCol && "sm:col-span-2")}
      >
        {isSubmitting && <Spinner className="mr-2" />}
        {buttonText}
      </Button>
    </form>
  );
}
