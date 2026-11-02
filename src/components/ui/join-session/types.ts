import type { DateTime } from "ts-luxon";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

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

export interface WhenLine {
  text: string;
  tone: "accent" | "muted" | "faint";
}

export interface CarouselPerson {
  person: MenuPerson;
  /** None until the person's sessions have loaded. */
  when: Option<WhenLine>;
  inactive: boolean;
}

export type DotKind = "past" | "upcoming" | "today" | "current";

export interface MonthGroup {
  key: string;
  label: string;
  selected: boolean;
  sessions: MenuSession[];
}
