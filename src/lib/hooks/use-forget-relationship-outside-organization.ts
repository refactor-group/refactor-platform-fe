"use client";

import { useEffect } from "react";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

interface Options {
  relationships: CoachingRelationshipWithUserNames[];
  isLoading: boolean;
  isError: boolean;
  currentId: Option<Id>;
  forget: () => void;
}

/**
 * Forgets the selected relationship once the current organization's relationships
 * load without it, as after an organization switch, so its reads don't 404.
 */
export function useForgetRelationshipOutsideOrganization({
  relationships,
  isLoading,
  isError,
  currentId,
  forget,
}: Options): void {
  const isStale = currentId.some && !isLoading && !isError &&
    !relationships.some((relationship) => relationship.id === currentId.val);

  useEffect(() => {
    if (isStale) forget();
  }, [isStale, forget]);
}
