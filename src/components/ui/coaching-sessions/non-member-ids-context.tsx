"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Id } from "@/types/general";

/** Participants no longer in the organization, for the assignee pickers below. */
const NonMemberIdsContext = createContext<readonly Id[]>([]);

export function NonMemberIdsProvider({ ids, children }: { ids: readonly Id[]; children: ReactNode }) {
  // Keyed on contents: callers rebuild the array each render.
  const key = ids.join(",");
  const value = useMemo(() => (key ? key.split(",") : []), [key]);
  return <NonMemberIdsContext.Provider value={value}>{children}</NonMemberIdsContext.Provider>;
}

export function useNonMemberIds(): readonly Id[] {
  return useContext(NonMemberIdsContext);
}
