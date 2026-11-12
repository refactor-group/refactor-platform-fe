"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Id } from "@/types/general";

/** Participants no longer in the organization, for the assignee pickers below. */
const NonMemberIdsContext = createContext<readonly Id[]>([]);

export function NonMemberIdsProvider({ ids, children }: { ids: readonly Id[]; children: ReactNode }) {
  return <NonMemberIdsContext.Provider value={ids}>{children}</NonMemberIdsContext.Provider>;
}

export function useNonMemberIds(): readonly Id[] {
  return useContext(NonMemberIdsContext);
}
