import { CoachingSession } from "@/types/coaching-session";
import {
  getRelationshipsAsCoach,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
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
  CoachingSessionApi,
  useCoachingSessionList,
  useCoachingSessionMutation,
} from "@/lib/api/coaching-sessions";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useState, useMemo, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { defaultCoachingSession } from "@/types/coaching-session";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { EntityApiError } from "@/types/entity-api-error";
import { toast } from "sonner";
import { Provider } from "@/types/provider";
import {
  CreateRecurringSessionRequest,
  Frequency,
  MAX_INTERVAL,
  MAX_OCCURRENCES,
  Recurrence,
  RecurrenceEnd,
  WEEKDAYS_ORDERED,
  Weekday,
  frequencyLabel,
  frequencySupportsWeekdays,
  recurrenceToPayload,
  validateRecurrence,
  weekdayFromLuxon,
  weekdayLabel,
} from "@/types/recurrence";

export type CoachingSessionFormMode = "create" | "update";

interface CoachingSessionFormProps {
  existingSession?: CoachingSession;
  mode: CoachingSessionFormMode;
  onOpenChange: (open: boolean) => void;
}


export default function CoachingSessionForm({
  existingSession,
  mode,
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

  // ── Recurrence state (create mode only) ─────────────────────────────
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>(Frequency.Weekly);
  const [interval, setInterval] = useState<number>(1);
  const [byWeekdays, setByWeekdays] = useState<Weekday[]>([]);
  const [end, setEnd] = useState<RecurrenceEnd>({ kind: "count", count: 4 });

  // Computes a default end date for the "On" option so the user never sees
  // an empty-state "Pick an end date" error before they've had a chance to
  // act. Anchored to sessionDate when set, otherwise today; both fall back
  // to + 4 weeks (matches the count default of 4 occurrences for weekly).
  const defaultUntilDate = (): string => {
    const userTimezone = userSession?.timezone || getBrowserTimezone();
    const anchor = sessionDate
      ? DateTime.fromJSDate(sessionDate).setZone(userTimezone)
      : DateTime.now().setZone(userTimezone);
    return anchor.plus({ weeks: 4 }).toFormat("yyyy-MM-dd");
  };

  // The weekday of the start date (in the user's timezone). When recurring
  // is on with weekly/biweekly + by_weekdays, the backend requires this
  // weekday to be included — otherwise 422. We auto-seed the selection so
  // the obvious case Just Works.
  const startWeekday = useMemo<Weekday | null>(() => {
    if (!sessionDate) return null;
    const userTimezone = userSession?.timezone || getBrowserTimezone();
    const local = DateTime.fromJSDate(sessionDate).setZone(userTimezone);
    return weekdayFromLuxon(local.weekday);
  }, [sessionDate, userSession?.timezone]);

  // Auto-seed by_weekdays so the user never sees an empty selection. Prefer
  // the start_at weekday; fall back to today's weekday in the user's
  // timezone when no session date is set yet. We never overwrite an
  // explicit user choice — only fill an empty selection.
  useEffect(() => {
    if (!isRecurring) return;
    if (!frequencySupportsWeekdays(frequency)) return;
    if (byWeekdays.length !== 0) return;
    const userTimezone = userSession?.timezone || getBrowserTimezone();
    const seed =
      startWeekday ??
      weekdayFromLuxon(DateTime.now().setZone(userTimezone).weekday);
    setByWeekdays([seed]);
  }, [
    isRecurring,
    frequency,
    startWeekday,
    byWeekdays.length,
    userSession?.timezone,
  ]);

  const resetForm = () => {
    setSessionDate(undefined);
    setSessionTime("");
    setSelectedRelationshipId(currentCoachingRelationshipId ?? "");
    setIsRecurring(false);
    setFrequency(Frequency.Weekly);
    setInterval(1);
    setByWeekdays([]);
    setEnd({ kind: "count", count: 4 });
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
    const payload: CreateRecurringSessionRequest = {
      coaching_relationship_id: relationshipId,
      start_at: dateTime,
      recurrence,
    };
    const created = await CoachingSessionApi.createRecurring(payload);
    toast.success(
      `Created ${created.length} recurring session${created.length === 1 ? "" : "s"}.`
    );
  };

  const handleUpdateSession = async (dateTime: string) => {
    if (!existingSession) return;
    await update(existingSession.id, {
      ...existingSession,
      date: dateTime,
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
      if (!(error instanceof EntityApiError)) {
        console.error(`Failed to ${mode} coaching session:`, error);
      } else if (error.status === 409 && error.data?.error === "oauth_token_revoked") {
        toast.error("Your Google Meet integration has been disconnected. Please reconnect in Settings.");
        router.push("/settings/integrations");
      } else {
        const message = error.isNetworkError()
          ? "Could not connect to server. Please check your internet connection."
          : error.status === 502
            ? "Could not create Google Meet link due to a connection error. Please try again."
            : error.status === 422
              ? `Couldn't ${mode === "update" ? "update" : "create"} ${isRecurring ? "the recurring sessions" : "the session"}. Please review the form and try again.`
              : `Failed to ${mode} coaching session. Please try again.`;
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

  // Determine if form can be submitted
  const canSubmit = (() => {
    if (!sessionDate || !sessionTime || isSubmitting) return false;
    if (mode === "create") {
      const relationshipId = selectedRelationshipId || currentCoachingRelationshipId;
      if (!relationshipId) return false;
    }
    if (recurrenceError) return false;
    return true;
  })();

  const buttonText =
    mode === "update"
      ? "Update Session"
      : isRecurring
        ? "Create Recurring Sessions"
        : "Create Session";

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Coachee selector - only shown in create mode */}
        {mode === "create" && (
          <div className="space-y-2">
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
        <div className="space-y-2">
          <Label htmlFor="session-date">Session Date</Label>
          <Calendar
            mode="single"
            selected={sessionDate}
            onSelect={(date) => setSessionDate(date)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="session-time">Session Time</Label>
          <input
            type="time"
            id="session-time"
            value={sessionTime}
            onChange={(e) => setSessionTime(e.target.value)}
            className="w-full border rounded p-2"
            required
            disabled={isSubmitting}
          />
        </div>

        {/* Recurring section — create mode only. Editing a recurrence rule
            is a different operation that isn't supported by this dialog. */}
        {mode === "create" && (
          <div className="space-y-3 rounded-md border p-3">
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
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="recurrence-frequency">Frequency</Label>
                    <Select
                      value={frequency}
                      onValueChange={(v) => setFrequency(v as Frequency)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="recurrence-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(Frequency).map((f) => (
                          <SelectItem key={f} value={f}>
                            {frequencyLabel(f)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurrence-interval">Every</Label>
                    <Input
                      id="recurrence-interval"
                      type="number"
                      min={1}
                      max={MAX_INTERVAL}
                      value={interval}
                      onChange={(e) => {
                        const next = parseInt(e.target.value, 10);
                        setInterval(Number.isFinite(next) && next >= 1 ? next : 1);
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {frequencySupportsWeekdays(frequency) && (
                  <div className="space-y-2">
                    <Label>On these days</Label>
                    <ToggleGroup
                      type="multiple"
                      value={byWeekdays}
                      onValueChange={(v) => setByWeekdays(v as Weekday[])}
                      disabled={isSubmitting}
                      className="justify-start flex-wrap"
                    >
                      {WEEKDAYS_ORDERED.map((d) => (
                        <ToggleGroupItem
                          key={d}
                          value={d}
                          aria-label={weekdayLabel(d)}
                          className="w-10"
                        >
                          {weekdayLabel(d).slice(0, 1)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {startWeekday && (
                      <p className="text-xs text-muted-foreground">
                        First session is a {weekdayLabel(startWeekday)} — it must be selected.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Ends</Label>
                  <RadioGroup
                    value={end.kind}
                    onValueChange={(v) =>
                      setEnd(
                        v === "count"
                          ? { kind: "count", count: end.kind === "count" ? end.count : 4 }
                          : {
                              kind: "until",
                              until:
                                end.kind === "until" && end.until
                                  ? end.until
                                  : defaultUntilDate(),
                            }
                      )
                    }
                    disabled={isSubmitting}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem id="end-count" value="count" />
                      <Label htmlFor="end-count" className="cursor-pointer">
                        After
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={MAX_OCCURRENCES}
                        value={end.kind === "count" ? end.count : ""}
                        onChange={(e) => {
                          const next = parseInt(e.target.value, 10);
                          setEnd({
                            kind: "count",
                            count: Number.isFinite(next) && next >= 1 ? next : 1,
                          });
                        }}
                        disabled={isSubmitting || end.kind !== "count"}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        occurrences
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem id="end-until" value="until" />
                      <Label htmlFor="end-until" className="cursor-pointer">
                        On
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSubmitting || end.kind !== "until"}
                            className={cn(
                              "h-9 gap-2 font-normal",
                              end.kind === "until" && end.until
                                ? ""
                                : "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="h-4 w-4" />
                            {end.kind === "until" && end.until
                              ? DateTime.fromISO(end.until).toLocaleString(
                                  DateTime.DATE_MED
                                )
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={
                              end.kind === "until" && end.until
                                ? new Date(`${end.until}T00:00:00`)
                                : undefined
                            }
                            onSelect={(date) =>
                              setEnd({
                                kind: "until",
                                until: date
                                  ? DateTime.fromJSDate(date).toFormat(
                                      "yyyy-MM-dd"
                                    )
                                  : "",
                              })
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </RadioGroup>
                </div>

                {recurrenceError && (
                  <p className="text-sm text-destructive">{recurrenceError}</p>
                )}
              </div>
            )}
          </div>
        )}

        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting && <Spinner className="mr-2" />}
          {buttonText}
        </Button>
      </form>
    </div>
  );
}
