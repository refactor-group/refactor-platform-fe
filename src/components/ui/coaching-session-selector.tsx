"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDateTimeFromString, Id } from "@/types/general";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { useEffect } from "react";
import { DateTime } from "ts-luxon";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { CoachingSession } from "@/types/coaching-session";
import {
  useOverarchingGoalBySession,
  useOverarchingGoalList,
} from "@/lib/api/overarching-goals";

interface CoachingSessionsSelectorProps extends PopoverProps {
  relationshipId: Id;
  disabled: boolean;
  onSelect?: (coachingSessionId: Id) => void;
}

function CoachingSessionsSelectItems({
  relationshipId,
}: {
  relationshipId: Id;
}) {
  const fromDate = DateTime.now().minus({ month: 1 });
  const toDate = DateTime.now().plus({ month: 1 });

  const {
    coachingSessions,
    isLoading: isLoadingSessions,
    isError: isErrorSessions,
  } = useCoachingSessionList(relationshipId, fromDate, toDate);

  const { setCurrentCoachingSessions } = useCoachingSessionStateStore(
    (state) => state
  );

  useEffect(() => {
    if (!coachingSessions.length) return;
    setCurrentCoachingSessions(coachingSessions);
  }, [coachingSessions]);

  if (isLoadingSessions) return <div>Loading...</div>;
  if (isErrorSessions) return <div>Error loading coaching sessions</div>;
  if (!coachingSessions?.length) return <div>No coaching sessions found</div>;

  return (
    <>
      {[
        {
          label: "Previous Sessions",
          condition: (date: string) =>
            getDateTimeFromString(date) < DateTime.now(),
        },
        {
          label: "Upcoming Sessions",
          condition: (date: string) =>
            getDateTimeFromString(date) >= DateTime.now(),
        },
      ].map(
        ({ label, condition }) =>
          coachingSessions.some((session) => condition(session.date)) && (
            <SelectGroup key={label}>
              <SelectLabel>{label}</SelectLabel>
              {coachingSessions
                .filter((session) => condition(session.date))
                .map((session) => (
                  <SessionItemWithGoal key={session.id} session={session} />
                ))}
            </SelectGroup>
          )
      )}
    </>
  );
}

// Separate component to handle individual session goal fetching
function SessionItemWithGoal({ session }: { session: CoachingSession }) {
  const { overarchingGoal, isLoading, isError } = useOverarchingGoalBySession(
    session.id
  );

  if (isLoading) return <div>Loading goal...</div>;
  if (isError) return <div>Error loading goal</div>;

  return (
    <SelectItem value={session.id}>
      <div className="flex min-w-0">
        <div className="min-w-0 w-full">
          <p className="truncate text-sm font-medium">
            {overarchingGoal.title || "No goal set"}
          </p>
          <p className="truncate text-sm text-gray-400">
            {getDateTimeFromString(session.date).toLocaleString(
              DateTime.DATETIME_FULL
            )}
          </p>
        </div>
      </div>
    </SelectItem>
  );
}

export default function CoachingSessionSelector({
  relationshipId,
  disabled,
  onSelect,
  ...props
}: CoachingSessionsSelectorProps) {
  const {
    currentCoachingSessionId,
    setCurrentCoachingSessionId,
    getCurrentCoachingSession,
  } = useCoachingSessionStateStore((state) => state);

  const currentSession = currentCoachingSessionId
    ? getCurrentCoachingSession(currentCoachingSessionId)
    : null;

  const {
    overarchingGoal,
    isLoading: isLoadingGoal,
    isError: isErrorGoal,
  } = useOverarchingGoalBySession(currentCoachingSessionId);
  const handleSetCoachingSession = (coachingSessionId: Id) => {
    setCurrentCoachingSessionId(coachingSessionId);
    if (onSelect) {
      onSelect(coachingSessionId);
    }
  };

  const displayValue = currentSession ? (
    <div className="flex flex-col w-full">
      <span className="truncate text-left">
        {isLoadingGoal ? "Loading..." : overarchingGoal.title || "No goal set"}
      </span>
      <span className="text-sm text-gray-500 text-left truncate">
        {getDateTimeFromString(currentSession.date).toLocaleString(
          DateTime.DATETIME_FULL
        )}
      </span>
    </div>
  ) : undefined;

  return (
    <Select
      disabled={disabled}
      value={currentCoachingSessionId ?? undefined}
      onValueChange={handleSetCoachingSession}
    >
      <SelectTrigger
        className="w-full min-w-0 py-6 pr-2"
        id="coaching-session-selector"
      >
        <SelectValue className="truncate" placeholder="Select coaching session">
          {displayValue}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className="w-[var(--radix-select-trigger-width)] min-w-0 max-w-full"
        position="popper"
      >
        <CoachingSessionsSelectItems relationshipId={relationshipId} />
      </SelectContent>
    </Select>
  );
}
