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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { getDateTimeFromString, Id, EntityApiError } from "@/types/general";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { useOverarchingGoalBySession } from "@/lib/api/overarching-goals";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { DateTime } from "ts-luxon";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  formatDateInUserTimezone,
  getBrowserTimezone,
} from "@/lib/timezone-utils";

interface CoachingSessionsSelectorProps extends PopoverProps {
  relationshipId: Id | null;
  disabled: boolean;
  onSelect?: (coachingSessionId: Id) => void;
}

function CoachingSessionsSelectItems({
  relationshipId,
}: {
  relationshipId: Id | null;
}) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id;

  const fromDate = DateTime.now().minus({ month: 1 });
  const toDate = DateTime.now().plus({ month: 1 });

  const { enrichedSessions, isLoading, isError } =
    useEnrichedCoachingSessionsForUser(
      userId ?? null,
      fromDate,
      toDate,
      [CoachingSessionInclude.Goal],
      "date",
      "desc",
      relationshipId ?? undefined
    );

  // Early return if no relationship - component will be disabled anyway
  if (!relationshipId) {
    return (
      <div className="p-2 text-sm text-muted-foreground">
        Select a coaching relationship
      </div>
    );
  }

  if (isLoading || !userId) {
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col space-y-1.5 pl-8">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    const isUnavailable =
      EntityApiError.isEntityApiError(isError) && isError.isServiceUnavailable();
    return (
      <div className="p-2 text-sm text-destructive">
        {isUnavailable
          ? "Service temporarily unavailable. Please try again."
          : "Error loading coaching sessions"}
      </div>
    );
  }

  if (!enrichedSessions.length) {
    return (
      <div className="p-2 text-sm text-muted-foreground">
        No coaching sessions found
      </div>
    );
  }

  return (
    <>
      {[
        {
          label: "Upcoming Sessions",
          condition: (date: string) =>
            getDateTimeFromString(date) >= DateTime.now(),
        },
        {
          label: "Previous Sessions",
          condition: (date: string) =>
            getDateTimeFromString(date) < DateTime.now(),
        },
      ].map(
        ({ label, condition }) =>
          enrichedSessions.some((session) => condition(session.date)) && (
            <SelectGroup key={label}>
              <SelectLabel>{label}</SelectLabel>
              {enrichedSessions
                .filter((session) => condition(session.date))
                .map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    timezone={userSession?.timezone}
                  />
                ))}
            </SelectGroup>
          )
      )}
    </>
  );
}

// Session item that displays goal from enriched session data (no separate API call)
function SessionItem({
  session,
  timezone,
}: {
  session: EnrichedCoachingSession;
  timezone?: string;
}) {
  return (
    <SelectItem value={session.id} className="pl-8">
      <div className="flex min-w-0 ml-4">
        <div className="min-w-0 w-full">
          <p className="truncate text-sm font-medium">
            {session.overarching_goal?.title || "No goal set"}
          </p>
          <p className="truncate text-sm text-gray-400">
            {formatDateInUserTimezone(
              session.date,
              timezone || getBrowserTimezone()
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
  ..._props
}: CoachingSessionsSelectorProps) {
  const router = useRouter();

  // Get current coaching session from URL
  const { currentCoachingSessionId, currentCoachingSession, isLoading: isLoadingSession } =
    useCurrentCoachingSession();

  const { userSession } = useAuthStore((state) => state);

  const { overarchingGoal, isLoading: isLoadingGoal } =
    useOverarchingGoalBySession(currentCoachingSessionId || "");

  const handleSetCoachingSession = (coachingSessionId: Id) => {
    // Navigate to the coaching session page
    router.push(`/coaching-sessions/${coachingSessionId}`);

    if (onSelect) {
      onSelect(coachingSessionId);
    }
  };

  const displayValue = isLoadingSession ? (
    <div className="flex flex-col w-full">
      <span className="flex items-center gap-2 text-left">
        <Spinner className="size-3" />
        <span className="truncate">Loading session...</span>
      </span>
    </div>
  ) : currentCoachingSession ? (
    <div className="flex flex-col w-full">
      <span className="truncate text-left">
        {isLoadingGoal ? (
          <span className="flex items-center gap-2">
            <Spinner className="size-3" />
            <span>Loading goal...</span>
          </span>
        ) : (
          overarchingGoal?.title || "No goal set"
        )}
      </span>
      <span className="text-sm text-gray-500 text-left truncate">
        {currentCoachingSession.date &&
          formatDateInUserTimezone(
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
