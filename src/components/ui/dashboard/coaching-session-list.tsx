"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateTime } from "ts-luxon";
import { ArrowUpDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import CoachingSession from "@/components/ui/coaching-session";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import {
  createCoachingSession,
  useCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { Calendar } from "@/components/ui/calendar";

export default function CoachingSessionList() {
  const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore(
    (state) => state
  );
  const { isCoach } = useAuthStore((state) => state);
  const {
    coachingSessions,
    isLoading: isLoadingCoachingSessions,
    isError: isErrorCoachingSessions,
    mutate,
  } = useCoachingSessions(currentCoachingRelationshipId);

  const [sortByDate, setSortByDate] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState<Date | undefined>(
    undefined
  );
  const [newSessionTime, setNewSessionTime] = useState<string>("");

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newSessionDate || !newSessionTime) return;

    // Combine date and time
    const [hours, minutes] = newSessionTime.split(":").map(Number);
    const dateTime = DateTime.fromJSDate(newSessionDate)
      .set({ hour: hours, minute: minutes })
      .toFormat("yyyy-MM-dd'T'HH:mm:ss");

    createCoachingSession(currentCoachingRelationshipId, dateTime)
      .then(() => {
        setIsDialogOpen(false);
        setNewSessionDate(undefined);
        setNewSessionTime("");

        // Trigger a re-fetch of coaching sessions
        mutate();
      })
      .catch((err) => {
        console.error("Failed to create new Coaching Session: " + err);
        throw err;
      });
  };

  const sortedSessions = coachingSessions
    ? [...coachingSessions].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
    : [];

  if (isLoadingCoachingSessions) return <div>Loading coaching sessions...</div>;
  if (isErrorCoachingSessions)
    return <div>Error loading coaching sessions</div>;

  return (
    <Card className="flex-1">
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-xl sm:text-2xl">
            Coaching Sessions
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!isCoach || !currentCoachingRelationshipId}
              >
                Create New Coaching Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Coaching Session</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="session-date">Session Date</Label>
                  <Calendar
                    mode="single"
                    selected={newSessionDate}
                    onSelect={setNewSessionDate}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-time">Session Time</Label>
                  <input
                    type="time"
                    id="session-time"
                    value={newSessionTime}
                    onChange={(e) => setNewSessionTime(e.target.value)}
                    className="w-full border rounded p-2"
                    required
                  />
                </div>
                <Button type="submit">Create Session</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full sm:w-auto justify-between"
            onClick={() => setSortByDate(true)}
          >
            <span>Date and Time</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full sm:w-auto justify-between"
            onClick={() => setSortByDate(false)}
          >
            <span>Overarching Goal</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!currentCoachingRelationshipId ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-lg text-muted-foreground">
              Choose a Relationship to view Coaching Sessions
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedSessions.map((coachingSession) => (
              <CoachingSession
                key={coachingSession.id}
                coachingSession={coachingSession}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
