import { CoachingSession } from "@/types/coaching-session";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import {
  useCoachingSessionList,
  useCoachingSessionMutation,
} from "@/lib/api/coaching-sessions";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useState } from "react";
import { defaultCoachingSession } from "@/types/coaching-session";
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
  const fromDate = DateTime.now().minus({ month: 1 });
  const toDate = DateTime.now().plus({ month: 1 });
  const { refresh } = useCoachingSessionList(
    currentCoachingRelationshipId,
    fromDate,
    toDate
  );
  const { create: createCoachingSession, update } =
    useCoachingSessionMutation();
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
    onOpenChange(false);
  };

  const handleCreateSession = async (dateTime: string) => {
    const newCoachingSession: CoachingSession = {
      ...defaultCoachingSession(),
      coaching_relationship_id: currentCoachingRelationshipId,
      date: dateTime,
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
    if (!sessionDate || !sessionTime) return;

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

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          />
        </div>
        <Button type="submit" disabled={!sessionDate || !sessionTime}>
          {mode === "create" ? "Create Session" : "Update Session"}
        </Button>
      </form>
    </div>
  );
}
