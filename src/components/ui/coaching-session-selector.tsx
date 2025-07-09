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
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { DateTime } from "ts-luxon";
import { CoachingSession } from "@/types/coaching-session";
import {
  useOverarchingGoalBySession,
  useOverarchingGoalList,
} from "@/lib/api/overarching-goals";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  formatDateInUserTimezone,
  getBrowserTimezone,
} from "@/lib/timezone-utils";

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
  const { userSession } = useAuthStore((state) => state);

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
            {formatDateInUserTimezone(
              session.date,
              userSession.timezone || getBrowserTimezone()
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
  const router = useRouter();

  // Get current coaching session from URL
  const { currentCoachingSessionId, currentCoachingSession, isLoading: isLoadingSession } =
    useCurrentCoachingSession();

  const { userSession } = useAuthStore((state) => state);

  const {
    overarchingGoal,
    isLoading: isLoadingGoal,
    isError: isErrorGoal,
  } = useOverarchingGoalBySession(currentCoachingSessionId || "");

  const handleSetCoachingSession = (coachingSessionId: Id) => {
    // Navigate to the coaching session page
    router.push(`/coaching-sessions/${coachingSessionId}`);

    if (onSelect) {
      onSelect(coachingSessionId);
    }
  };

  const displayValue = isLoadingSession ? (
    <div className="flex flex-col w-full">
      <span className="truncate text-left">Loading session...</span>
    </div>
  ) : currentCoachingSession ? (
    <div className="flex flex-col w-full">
      <span className="truncate text-left">
        {isLoadingGoal ? "Loading..." : overarchingGoal?.title || "No goal set"}
      </span>
      <span className="text-sm text-gray-500 text-left truncate">
        {currentCoachingSession.date && formatDateInUserTimezone(
          currentCoachingSession.date,
          userSession.timezone || getBrowserTimezone()
        )}
      </span>
    </div>
  ) : undefined;

  return (
    <Select
      disabled={disabled}
      value={currentCoachingSessionId || undefined}
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
