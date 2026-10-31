import type { DateTime } from "ts-luxon";
import type { Id } from "@/types/general";

export type Liveness = "live" | "soon" | "none";

export interface MenuSession {
  id: Id;
  start: DateTime;
  title: string;
  liveness: Liveness;
}

export interface MenuPerson {
  userId: Id;
  firstName: string;
  fullName: string;
  initials: string;
}

export type DotKind = "past" | "upcoming" | "today" | "current";

export interface MonthGroup {
  key: string;
  label: string;
  selected: boolean;
  sessions: MenuSession[];
}
