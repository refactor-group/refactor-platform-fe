"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from 'date-fns';
import { ArrowUpDown, CalendarPlus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import CoachingSession from "@/components/ui/coaching-session"
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider"
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider"
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { createCoachingSession, useCoachingSessions } from "@/lib/api/coaching-sessions";


export default function CoachingSessionList() {
  const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore((state) => state)
  const { currentOrganizationId } = useOrganizationStateStore((state) => state)
  const {
    coachingSessions,
    isLoading: isLoadingCoachingSessions,
    isError: isErrorCoachingSessions,
  } = useCoachingSessions(currentCoachingRelationshipId);
  const { setCurrentCoachingSessions } = useCoachingSessionStateStore(
    (state) => state
  );

  const [sortByDate, setSortByDate] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSessionDate, setNewSessionDate] = useState("")

  useEffect(() => {
    console.info("useEffect called")
    if (!coachingSessions.length) return;
    setCurrentCoachingSessions(coachingSessions);
  }, [coachingSessions, currentCoachingRelationshipId, currentOrganizationId]);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();

    // Format the date string
    const formattedDate = format(new Date(newSessionDate), "yyyy-MM-dd'T'HH:mm:ss");

    createCoachingSession(currentCoachingRelationshipId, formattedDate).then((createdCoachingSession) => {
      setIsDialogOpen(false);
      setNewSessionDate("");
      setCurrentCoachingSessions([...coachingSessions, createdCoachingSession]);
    }).catch((err) => {
      console.error("Failed to create new Coaching Session: " + err);
      throw err;
    });
  }

  const sortedSessions = [...coachingSessions].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  if (!currentCoachingRelationshipId) return <div>Choose a Coaching Relationship to View Coaching Sessions</div>
  if (isLoadingCoachingSessions) return <div>Loading coaching sessions...</div>
  if (isErrorCoachingSessions) return <div>Error loading coaching sessions</div>

  return (
    <Card className="flex-1">
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-xl sm:text-2xl">Coaching Sessions</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!currentCoachingRelationshipId}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                Create New Coaching Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Coaching Session</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="session-date">Session Date and Time</Label>
                  <Input
                    id="session-date"
                    type="datetime-local"
                    required
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
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
        <div className="space-y-4">
          {sortedSessions.map((coachingSession) => (
            <CoachingSession key={coachingSession.id} coachingSession={coachingSession} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
