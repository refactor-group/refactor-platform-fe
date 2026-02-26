import { CoachingSession } from "@/types/coaching-session";
import { getRelationshipsAsCoach } from "@/types/coaching-relationship";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useState, useMemo } from "react";
import { defaultCoachingSession, DEFAULT_MEETING_PROVIDER } from "@/types/coaching-session";
import { getBrowserTimezone } from "@/lib/timezone-utils";

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
  const { create: createCoachingSession, update } =
    useCoachingSessionMutation();

  // Fetch relationships to populate coachee selector (only needed in create mode)
  const { relationships, isLoading: isLoadingRelationships } =
    useCoachingRelationshipList(currentOrganizationId ?? "");

  // Filter to relationships where current user is the coach
  const coacheeRelationships = useMemo(() => {
    if (!userSession?.id || !relationships) return [];
    return getRelationshipsAsCoach(userSession.id, relationships);
  }, [relationships, userSession?.id]);

  // State for selected coachee in create mode
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string>(
    () => existingSession?.coaching_relationship_id ?? currentCoachingRelationshipId ?? ""
  );

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

  const resetForm = () => {
    setSessionDate(undefined);
    setSessionTime("");
    setSelectedRelationshipId(currentCoachingRelationshipId ?? "");
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
      provider: DEFAULT_MEETING_PROVIDER,
    };
    await createCoachingSession(newCoachingSession);
  };

  const handleUpdateSession = async (dateTime: string) => {
    if (!existingSession) return;
    await update(existingSession.id, {
      ...existingSession,
      date: dateTime,
      updated_at: DateTime.now().toUTC(),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      mode === "create" ? handleCreateSession : handleUpdateSession;

    try {
      await handler(utcDateTime);
      refresh();
    } catch (error) {
      // TODO: We might want to show a toast here if/when we get that infrastructure in place
      console.error(`Failed to ${mode} coaching session:`, error);
    } finally {
      resetForm();
    }
  };

  // Determine if form can be submitted
  const canSubmit = (() => {
    if (!sessionDate || !sessionTime || isSubmitting) return false;
    if (mode === "create") {
      const relationshipId = selectedRelationshipId || currentCoachingRelationshipId;
      return !!relationshipId;
    }
    return true;
  })();

  const buttonText = mode === "create" ? "Create Session" : "Update Session";

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
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting && <Spinner className="mr-2" />}
          {buttonText}
        </Button>
      </form>
    </div>
  );
}
