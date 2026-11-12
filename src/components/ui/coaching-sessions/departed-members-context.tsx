"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CoachingRelationship } from "@/types/coaching-relationship";
import type { Id } from "@/types/general";

/** Participants who left the organization: they keep existing assignments but can't be newly assigned. */
const DepartedMembersContext = createContext<ReadonlySet<Id>>(new Set());

export function departedMembersOf(relationship: CoachingRelationship | undefined): Id[] {
  if (!relationship) return [];
  return [
    ...(relationship.coach_is_member ? [] : [relationship.coach_id]),
    ...(relationship.coachee_is_member ? [] : [relationship.coachee_id]),
  ];
}

export function DepartedMembersProvider({
  relationship,
  children,
}: {
  relationship: CoachingRelationship | undefined;
  children: ReactNode;
}) {
  const value = useMemo(() => new Set(departedMembersOf(relationship)), [relationship]);
  return <DepartedMembersContext.Provider value={value}>{children}</DepartedMembersContext.Provider>;
}

export function useDepartedMembers(): ReadonlySet<Id> {
  return useContext(DepartedMembersContext);
}

export const departedReason = (name: string): string => `${name} is no longer in this organization`;
