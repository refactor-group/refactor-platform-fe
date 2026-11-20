import { Button } from "@/components/ui/button";
import { NextSessionLabel } from "@/components/ui/dashboard/next-session-label";

interface NextSessionCardEmptyProps {
  canSchedule: boolean;
  onCreateSession: () => void;
}

/** Body of the Next session card when no session remains this week. */
export function NextSessionCardEmpty({ canSchedule, onCreateSession }: NextSessionCardEmptyProps) {
  return (
    <>
      <NextSessionLabel />
      <div className="my-auto">
        <p className="text-card-title">No more sessions this week.</p>
        <p className="mt-1.5 text-sm text-muted-foreground">Check back on Monday.</p>
      </div>
      {canSchedule && (
        <Button
          variant="secondary"
          className="mt-auto w-full min-h-11 sm:min-h-10"
          onClick={onCreateSession}
        >
          Schedule a session
        </Button>
      )}
    </>
  );
}
