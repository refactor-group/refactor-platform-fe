"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { DateTime } from "ts-luxon";
import type {
  DotKind,
  MenuPerson,
  MenuSession,
  MonthGroup,
} from "@/components/ui/join-session/types";
import { clampPage, pageOf } from "@/components/ui/join-session/person-carousel";
import {
  CoachingSessionInclude,
  type NearestWindow,
  useCoachingSession,
  useNearestCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  dotKind,
  livenessFromUrgency,
  monthGroups,
  sessionWindow,
} from "@/lib/session-window";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { calculateSessionUrgency } from "@/lib/utils/session";
import {
  type CoachingRelationshipWithUserNames,
  getRelationshipsForUser,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import type {
  CoachingSession,
  EnrichedCoachingSession,
} from "@/types/coaching-session";
import { coachingSessionTitle } from "@/types/coaching-session-title";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import { SessionUrgency } from "@/types/session-display";
import type { User } from "@/types/user";

export interface TodayEntry {
  session: MenuSession;
  person: MenuPerson;
}

export interface PersonEntry {
  person: MenuPerson;
  relationshipId: Id;
}

/** The coaching session page being viewed, once it has loaded. */
export interface CurrentSession {
  id: Id;
  relationshipId: Id;
  date: string;
}

export type PersonSessionsState =
  | { kind: "loading" }
  | { kind: "error"; retry: () => void }
  | {
      kind: "loaded";
      person: MenuPerson;
      list: MenuSession[];
      groups: MonthGroup[];
      kindOf: (session: MenuSession) => DotKind;
    }
  | { kind: "no-people" };

export interface JoinSessionMenuModel {
  today: TodayEntry[];
  people: MenuPerson[];
  selectedId: Option<Id>;
  page: number;
  current: Option<Id>;
  now: DateTime;
  sessions: PersonSessionsState;
  selectPerson: (userId: Id) => void;
  setPage: (page: number) => void;
  /** Call when the menu opens: back to the default person, fresh data. Nothing is fetched for the person until the first call. */
  reset: () => void;
}

const SESSION_PATH = /^\/coaching-sessions\/([^/]+)/;

export function sessionIdFromPath(pathname: string): Option<Id> {
  const match = SESSION_PATH.exec(pathname);
  return match ? Some(match[1]) : None;
}

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function menuPerson(userId: Id, first: string, last: string): MenuPerson {
  return {
    userId,
    firstName: first,
    fullName: `${first} ${last}`.trim(),
    initials: initialsOf(first, last),
  };
}

function otherParticipant(rel: CoachingRelationshipWithUserNames, userId: Id): MenuPerson {
  return rel.coach_id === userId
    ? menuPerson(rel.coachee_id, rel.coachee_first_name, rel.coachee_last_name)
    : menuPerson(rel.coach_id, rel.coach_first_name, rel.coach_last_name);
}

/** One entry per other person; a person in two relationships keeps the first. */
export function peopleFor(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): PersonEntry[] {
  const sorted = sortRelationshipsByParticipantName(
    getRelationshipsForUser(userId, relationships),
    userId
  );
  const seen = new Set<Id>();
  return sorted.flatMap((rel) => {
    const person = otherParticipant(rel, userId);
    if (seen.has(person.userId)) return [];
    seen.add(person.userId);
    return [{ person, relationshipId: rel.id }];
  });
}

export function toMenuSession(session: EnrichedCoachingSession, timezone: string): MenuSession {
  return {
    id: session.id,
    start: startIn(session.date, timezone),
    title:
      session.display_title && session.display_title.some
        ? session.display_title.val
        : coachingSessionTitle(session),
    liveness: livenessFromUrgency(calculateSessionUrgency(session)),
  };
}

function personFromUser(user: User): MenuPerson {
  return menuPerson(user.id, user.first_name, user.last_name);
}

function todayPerson(
  session: EnrichedCoachingSession,
  userId: Id,
  people: PersonEntry[]
): Option<MenuPerson> {
  const other = session.relationship?.coach_id === userId ? session.coachee : session.coach;
  if (other) return Some(personFromUser(other));
  const entry = people.find((p) => p.relationshipId === session.coaching_relationship_id);
  return entry ? Some(entry.person) : None;
}

function todayEntries(
  sessions: EnrichedCoachingSession[],
  userId: Id,
  people: PersonEntry[],
  timezone: string
): TodayEntry[] {
  return sessions
    .flatMap((session) => {
      const person = todayPerson(session, userId, people);
      return person.some ? [{ session: toMenuSession(session, timezone), person: person.val }] : [];
    })
    .sort((a, b) => a.session.start.toMillis() - b.session.start.toMillis());
}

/** The first of today's sessions that isn't over, else the last one. */
export function todayAnchor<T extends CoachingSession>(todays: T[]): Option<T> {
  if (todays.length === 0) return None;
  const open = todays.find((s) => calculateSessionUrgency(s) !== SessionUrgency.Past);
  return Some(open ?? todays[todays.length - 1]);
}

export interface WindowQueryInput {
  relationshipId: Id;
  today: Option<CoachingSession>;
  current: Option<CurrentSession>;
  now: DateTime;
}

/** Which `/nearest` window to request for the selected person. */
export function windowQuery(input: WindowQueryInput): NearestWindow {
  const { relationshipId, today, current, now } = input;
  if (today.some) {
    return { relationshipId, around: today.val.date, before: 2, after: 3 };
  }
  if (current.some && current.val.relationshipId === relationshipId) {
    return { relationshipId, around: current.val.date, before: 2, after: 3 };
  }
  return {
    relationshipId,
    around: now.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss'Z'"),
    before: 2,
    after: 2,
  };
}

function startIn(date: string, timezone: string): DateTime {
  return DateTime.fromISO(date, { zone: "utc" }).setZone(timezone);
}

function idOf<T extends { id: Id }>(value: Option<T>): Option<Id> {
  return value.some ? Some(value.val.id) : None;
}

interface PersonSessionsInput {
  relationships: { isLoading: boolean; isError: unknown; refresh: () => unknown };
  hasOrganization: boolean;
  selected: Option<PersonEntry>;
  nearest: { sessions: EnrichedCoachingSession[]; isLoading: boolean; isError: unknown; refresh: () => unknown };
  ready: boolean;
  today: Option<CoachingSession>;
  current: Option<CurrentSession>;
  now: DateTime;
  timezone: string;
}

/** Month labels highlight the person's current session, else today's, else now. */
function stripAnchor(input: PersonSessionsInput, relationshipId: Id): DateTime {
  const { current, today, now, timezone } = input;
  if (current.some && current.val.relationshipId === relationshipId) {
    return startIn(current.val.date, timezone);
  }
  return today.some ? startIn(today.val.date, timezone) : now;
}

function personSessions(input: PersonSessionsInput): PersonSessionsState {
  const { relationships, selected, nearest, now, timezone } = input;
  if (relationships.isError) return { kind: "error", retry: () => relationships.refresh() };
  if (selected.none) {
    return relationships.isLoading || !input.hasOrganization ? { kind: "loading" } : { kind: "no-people" };
  }
  if (nearest.isError) return { kind: "error", retry: () => nearest.refresh() };
  if (!input.ready || nearest.isLoading) return { kind: "loading" };

  const today = idOf(input.today);
  const current = idOf(input.current);
  const window = sessionWindow({
    sessions: nearest.sessions.map((s) => toMenuSession(s, timezone)),
    today,
    current,
    now,
  });
  return {
    kind: "loaded",
    person: selected.val.person,
    list: window.list,
    groups: monthGroups(window.dots, stripAnchor(input, selected.val.relationshipId)),
    kindOf: (session) => dotKind(session, { today, current, now }),
  };
}

function useCurrentSession(pathname: string): { current: Option<CurrentSession>; settled: boolean } {
  const id = sessionIdFromPath(pathname);
  // An empty id skips the fetch.
  const { coachingSession, isError } = useCoachingSession(id.some ? id.val : "");
  if (id.none) return { current: None, settled: true };
  if (coachingSession.id !== id.val) return { current: None, settled: Boolean(isError) };
  return {
    current: Some({
      id: coachingSession.id,
      relationshipId: coachingSession.coaching_relationship_id,
      date: coachingSession.date,
    }),
    settled: true,
  };
}

function resolveSelected(
  chosen: Option<Id>,
  people: PersonEntry[],
  current: Option<CurrentSession>
): Option<PersonEntry> {
  const byChoice = chosen.some ? people.find((p) => p.person.userId === chosen.val) : undefined;
  if (byChoice) return Some(byChoice);
  const byCurrent = current.some
    ? people.find((p) => p.relationshipId === current.val.relationshipId)
    : undefined;
  if (byCurrent) return Some(byCurrent);
  return people.length > 0 ? Some(people[0]) : None;
}

export function useJoinSessionMenu(): JoinSessionMenuModel {
  const { userId, userSession } = useAuthStore((state) => ({
    userId: state.userId,
    userSession: state.userSession,
  }));
  const timezone = userSession?.timezone || getBrowserTimezone();
  const { currentOrganizationId } = useCurrentOrganization();
  const pathname = usePathname() ?? "";

  const relationshipList = useCoachingRelationshipList(currentOrganizationId);
  const todays = useTodaysSessions([CoachingSessionInclude.Relationship]);
  const { current, settled: currentSettled } = useCurrentSession(pathname);

  const [chosen, setChosen] = useState<Option<Id>>(None);
  const [chosenPage, setChosenPage] = useState<Option<number>>(None);
  const [openedAt, setOpenedAt] = useState(() => DateTime.utc());
  // `/nearest` waits for the first open so closed headers cost nothing.
  const [hasOpened, setHasOpened] = useState(false);

  const people = peopleFor(userId, relationshipList.relationships);
  const menuPeople = people.map((p) => p.person);
  const selected = resolveSelected(chosen, people, current);
  const selectedId: Option<Id> = selected.some ? Some(selected.val.person.userId) : None;
  const page = clampPage(
    chosenPage.some ? chosenPage.val : selectedId.some ? pageOf(selectedId.val, menuPeople) : 0,
    menuPeople.length
  );

  const personTodays = selected.some
    ? todays.sessions.filter((s) => s.coaching_relationship_id === selected.val.relationshipId)
    : [];
  const anchorToday = todayAnchor(personTodays);
  const ready = hasOpened && selected.some && !todays.isLoading && currentSettled;
  const nearest = useNearestCoachingSessions(
    ready && selected.some
      ? Some({
          userId,
          ...windowQuery({
            relationshipId: selected.val.relationshipId,
            today: anchorToday,
            current,
            now: openedAt,
          }),
        })
      : None
  );

  const now = DateTime.now().setZone(timezone);
  const sessions = personSessions({
    relationships: relationshipList,
    hasOrganization: Boolean(currentOrganizationId),
    selected,
    nearest,
    ready,
    today: anchorToday,
    current,
    now,
    timezone,
  });

  return {
    today: todayEntries(todays.sessions, userId, people, timezone),
    people: menuPeople,
    selectedId,
    page,
    current: idOf(current),
    now,
    sessions,
    selectPerson: (id) => setChosen(Some(id)),
    setPage: (next) => setChosenPage(Some(next)),
    reset: () => {
      setChosen(None);
      setChosenPage(None);
      setOpenedAt(DateTime.utc());
      setHasOpened(true);
      todays.refresh();
    },
  };
}
