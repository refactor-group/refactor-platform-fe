"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { DateTime } from "ts-luxon";
import type {
  CarouselPerson,
  DotKind,
  MenuPerson,
  MenuSession,
  MonthGroup,
} from "@/components/ui/join-session/types";
import { cardCount, clampPage, pageOf } from "@/components/ui/join-session/person-carousel";
import {
  CoachingSessionInclude,
  type NearestWindow,
  useCoachingSession,
  useNearestCoachingSessions,
  useNearestEachCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  type PersonActivity,
  activityRelationship,
  byActivity,
  isInactive,
  personActivity,
  whenLine,
} from "@/lib/person-activity";
import {
  dotKind,
  livenessFromUrgency,
  monthGroups,
  sessionStartIn,
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

/** A person and every relationship the user has with them (two when they coach each other). */
export interface PersonEntry {
  person: MenuPerson;
  relationshipIds: Id[];
}

/** The selected person, narrowed to the relationship whose sessions the menu shows. */
interface SelectedPerson {
  person: MenuPerson;
  relationshipId: Id;
}

/** The coaching session page being viewed, once it has loaded. */
export interface CurrentSession {
  id: Id;
  relationshipId: Id;
  date: string;
}

export interface LoadedPersonSessions {
  kind: "loaded";
  person: MenuPerson;
  list: MenuSession[];
  groups: MonthGroup[];
  kindOf: (session: MenuSession) => DotKind;
}

export type PersonSessionsState =
  /** `previous` is a list shown earlier, kept on screen while the next loads. */
  | { kind: "loading"; previous: Option<LoadedPersonSessions> }
  | { kind: "error"; retry: () => void }
  | LoadedPersonSessions
  | { kind: "no-people" };

export interface JoinSessionMenuModel {
  today: TodayEntry[];
  /** A retry when today's sessions failed to load, so the menu can say so. */
  todayError: Option<() => void>;
  /** The carousel's people: soonest session first, inactive ones only once shown. */
  people: CarouselPerson[];
  /** Inactive people behind the carousel's trailing card. */
  hiddenInactive: number;
  showInactive: () => void;
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

/** One entry per other person, holding each relationship the user has with them. */
export function peopleFor(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): PersonEntry[] {
  const sorted = sortRelationshipsByParticipantName(
    getRelationshipsForUser(userId, relationships),
    userId
  );
  const byPerson = new Map<Id, PersonEntry>();
  for (const rel of sorted) {
    const person = otherParticipant(rel, userId);
    const entry = byPerson.get(person.userId);
    if (entry) entry.relationshipIds.push(rel.id);
    else byPerson.set(person.userId, { person, relationshipIds: [rel.id] });
  }
  return [...byPerson.values()];
}

export function toMenuSession(session: EnrichedCoachingSession, timezone: string): MenuSession {
  return {
    id: session.id,
    start: sessionStartIn(session.date, timezone),
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
  const entry = people.find((p) => p.relationshipIds.includes(session.coaching_relationship_id));
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
    around: utcInstant(now),
    before: 2,
    after: 2,
  };
}

function utcInstant(dt: DateTime): string {
  return dt.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
}

type ActivityByPerson = Map<Id, PersonActivity>;

const NO_SESSIONS: PersonActivity = { kind: "inactive", last: None };

/** Each person's activity from the sessions nearest now across their relationships. */
export function activityByPerson(
  people: PersonEntry[],
  sessions: EnrichedCoachingSession[],
  now: DateTime,
  timezone: string
): ActivityByPerson {
  return new Map(
    people.map(({ person, relationshipIds }) => {
      const theirs = sessions
        .filter((s) => relationshipIds.includes(s.coaching_relationship_id))
        .map((s) => ({
          start: sessionStartIn(s.date, timezone),
          over: calculateSessionUrgency(s) === SessionUrgency.Past,
          relationshipId: s.coaching_relationship_id,
        }));
      return [person.userId, personActivity(theirs, now)];
    })
  );
}

function carouselPerson(
  person: MenuPerson,
  activities: Option<ActivityByPerson>,
  now: DateTime
): CarouselPerson {
  const activity = activities.some ? activities.val.get(person.userId) : undefined;
  return activity
    ? { person, when: Some(whenLine(activity, now)), inactive: isInactive(activity) }
    : { person, when: None, inactive: false };
}

function idOf<T extends { id: Id }>(value: Option<T>): Option<Id> {
  return value.some ? Some(value.val.id) : None;
}

interface PersonSessionsInput {
  relationships: { isLoading: boolean; isError: unknown; refresh: () => unknown };
  hasOrganization: boolean;
  selected: Option<SelectedPerson>;
  nearest: { sessions: EnrichedCoachingSession[]; isLoading: boolean; isError: unknown; refresh: () => unknown };
  ready: boolean;
  today: Option<CoachingSession>;
  current: Option<CurrentSession>;
  now: DateTime;
  timezone: string;
}

/** Month labels highlight what the window centres on: today's session, else the current one, else now. */
function stripAnchor(input: PersonSessionsInput, relationshipId: Id): DateTime {
  const { current, today, now, timezone } = input;
  if (today.some) return sessionStartIn(today.val.date, timezone);
  if (current.some && current.val.relationshipId === relationshipId) {
    return sessionStartIn(current.val.date, timezone);
  }
  return now;
}

const LOADING: PersonSessionsState = { kind: "loading", previous: None };

function personSessions(input: PersonSessionsInput): PersonSessionsState {
  const { relationships, selected, nearest, now, timezone } = input;
  if (relationships.isError) return { kind: "error", retry: () => relationships.refresh() };
  if (selected.none) {
    return relationships.isLoading || !input.hasOrganization ? LOADING : { kind: "no-people" };
  }
  if (nearest.isError) return { kind: "error", retry: () => nearest.refresh() };
  if (!input.ready || nearest.isLoading) return LOADING;

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

function resolvePerson(
  chosen: Option<Id>,
  people: PersonEntry[],
  current: Option<CurrentSession>
): Option<PersonEntry> {
  const byChoice = chosen.some ? people.find((p) => p.person.userId === chosen.val) : undefined;
  if (byChoice) return Some(byChoice);
  const byCurrent = current.some
    ? people.find((p) => p.relationshipIds.includes(current.val.relationshipId))
    : undefined;
  if (byCurrent) return Some(byCurrent);
  return people.length > 0 ? Some(people[0]) : None;
}

/**
 * The viewed session's relationship, else the one with a session today, else
 * the one behind the card's when line, else the first.
 */
function relationshipFor(
  entry: PersonEntry,
  current: Option<CurrentSession>,
  todays: EnrichedCoachingSession[],
  activity: Option<PersonActivity>
): Id {
  const { relationshipIds } = entry;
  if (current.some && relationshipIds.includes(current.val.relationshipId)) {
    return current.val.relationshipId;
  }
  const today = todayAnchor(todays.filter((s) => relationshipIds.includes(s.coaching_relationship_id)));
  if (today.some) return today.val.coaching_relationship_id;
  const shown = activity.some ? activityRelationship(activity.val) : None;
  return shown.some ? shown.val : relationshipIds[0];
}

function resolveSelected(
  chosen: Option<Id>,
  people: PersonEntry[],
  current: Option<CurrentSession>,
  todays: EnrichedCoachingSession[],
  activities: Option<ActivityByPerson>
): Option<SelectedPerson> {
  const entry = resolvePerson(chosen, people, current);
  if (entry.none) return None;
  const found = activities.some ? activities.val.get(entry.val.person.userId) : undefined;
  const activity = found ? Some(found) : None;
  return Some({
    person: entry.val.person,
    relationshipId: relationshipFor(entry.val, current, todays, activity),
  });
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
  const [inactiveShown, setInactiveShown] = useState(false);
  const now = DateTime.now().setZone(timezone);

  const everyone = peopleFor(userId, relationshipList.relationships);
  const activity = useNearestEachCoachingSessions(
    hasOpened && everyone.length > 0
      ? Some({
          userId,
          relationshipIds: everyone.flatMap((p) => p.relationshipIds),
          around: utcInstant(openedAt),
          fetchedFor: String(openedAt.toMillis()),
        })
      : None
  );
  // Without activity (loading or failed) the carousel keeps name order and hides no one.
  const activitySettled = !activity.isLoading;
  const activities: Option<ActivityByPerson> =
    hasOpened && activitySettled && !activity.isError
      ? Some(activityByPerson(everyone, activity.sessions, now, timezone))
      : None;
  const people = activities.some
    ? byActivity(everyone, (p) => activities.val.get(p.person.userId) ?? NO_SESSIONS)
    : everyone;

  const selected = resolveSelected(chosen, people, current, todays.sessions, activities);
  const selectedId: Option<Id> = selected.some ? Some(selected.val.person.userId) : None;
  const ordered = people.map((p) => carouselPerson(p.person, activities, now));
  // A selected inactive person (e.g. the open session's) is never hidden.
  const revealed =
    inactiveShown || ordered.some((p) => p.inactive && selectedId.some && p.person.userId === selectedId.val);
  const visible = revealed ? ordered : ordered.filter((p) => !p.inactive);
  const hiddenInactive = ordered.length - visible.length;
  const page = clampPage(
    chosenPage.some ? chosenPage.val : selectedId.some ? pageOf(selectedId.val, visible) : 0,
    cardCount(visible.length, hiddenInactive)
  );

  const personTodays = selected.some
    ? todays.sessions.filter((s) => s.coaching_relationship_id === selected.val.relationshipId)
    : [];
  const anchorToday = todayAnchor(personTodays);
  // Waiting for activity keeps the default person from switching mid-load.
  const ready = hasOpened && selected.some && !todays.isLoading && currentSettled && activitySettled;
  const nearest = useNearestCoachingSessions(
    ready && selected.some
      ? Some({
          userId,
          // Each open refetches, so rows never outlive a session that moved or was deleted.
          fetchedFor: String(openedAt.toMillis()),
          ...windowQuery({
            relationshipId: selected.val.relationshipId,
            today: anchorToday,
            current,
            now: openedAt,
          }),
        })
      : None
  );

  const computed = personSessions({
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

  // The last loaded list, keyed by the fetched sessions (stable per request),
  // shown while the next loads instead of blinking placeholder rows: any list
  // once a person was picked this open, else only the same person's (reopening
  // refetches, as each open asks around a new time).
  const [lastLoaded, setLastLoaded] = useState<
    Option<{ source: EnrichedCoachingSession[]; sessions: LoadedPersonSessions }>
  >(None);
  if (computed.kind === "loaded" && (lastLoaded.none || lastLoaded.val.source !== nearest.sessions)) {
    setLastLoaded(Some({ source: nearest.sessions, sessions: computed }));
  }
  const showPrevious =
    computed.kind === "loading" &&
    lastLoaded.some &&
    (chosen.some || (selectedId.some && lastLoaded.val.sessions.person.userId === selectedId.val));
  const sessions: PersonSessionsState =
    showPrevious && lastLoaded.some
      ? { kind: "loading", previous: Some(lastLoaded.val.sessions) }
      : computed;

  return {
    today: todayEntries(todays.sessions, userId, everyone, timezone),
    todayError: todays.error ? Some(() => todays.refresh()) : None,
    people: visible,
    hiddenInactive,
    showInactive: () => setInactiveShown(true),
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
      setInactiveShown(false);
      setOpenedAt(DateTime.utc());
      setHasOpened(true);
      todays.refresh();
    },
  };
}
