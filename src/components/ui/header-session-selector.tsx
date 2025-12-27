"use client";

import { usePathname } from "next/navigation";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import CoachingSessionSelector from "@/components/ui/coaching-session-selector";

/**
 * Session selector for the site header.
 * Only renders when on a coaching session page and we have a valid relationship.
 */
export function HeaderSessionSelector() {
  const pathname = usePathname();
  const { currentCoachingRelationshipId } = useCurrentCoachingRelationship();

  // Only show on coaching session pages (e.g., /coaching-sessions/[id])
  const isCoachingSessionPage = pathname?.startsWith("/coaching-sessions/");

  if (!isCoachingSessionPage) {
    return null;
  }

  return (
    <div className="w-64 md:w-72 lg:w-80">
      <CoachingSessionSelector
        relationshipId={currentCoachingRelationshipId}
        disabled={!currentCoachingRelationshipId}
      />
    </div>
  );
}
