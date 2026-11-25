import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { peopleFor } from "@/lib/people";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { Id } from "@/types/general";

export interface ViewerRelationshipIds {
  relationshipIds: Id[];
  isLoading: boolean;
  isError: boolean;
}

/** Every relationship the viewer is in, in the current organization. */
export function useViewerRelationshipIds(): ViewerRelationshipIds {
  const userId = useAuthStore((s) => s.userId);
  const { currentOrganizationId } = useCurrentOrganization();
  const { relationships, isLoading, isError } = useCoachingRelationshipList(currentOrganizationId);
  return {
    relationshipIds: peopleFor(userId, relationships).flatMap((p) => p.relationshipIds),
    isLoading,
    isError: Boolean(isError),
  };
}
