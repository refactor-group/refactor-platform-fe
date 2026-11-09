import { DateTime } from "ts-luxon";
import { sessionStartIn } from "@/lib/session-window";
import { calculateSessionUrgency, getSessionParticipantInfo } from "@/lib/utils/session";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { SessionUrgency } from "@/types/session-display";

export enum CardTense {
  Past = "past",
  Live = "live",
  Upcoming = "upcoming",
}

export enum CardFooter {
  Done = "done",
  Ready = "ready",
  Prepare = "prepare",
}

export type CardNote =
  | { kind: "relative"; text: string; pulse: boolean; topicCount: number }
  | { kind: "topics"; count: number }
  | { kind: "noTopics" }
  | { kind: "moved" };

export interface CardContext {
  viewerId: Id;
  now: DateTime;
  timezone: string;
}

export interface CardView {
  session: EnrichedCoachingSession;
  start: DateTime;
  name: string;
  tense: CardTense;
  note: CardNote;
  footer: CardFooter;
  canManage: boolean;
  /** Not ended, or started today: still open to reschedule, drag and Move (D18). */
  editable: boolean;
}

export interface GridCard extends CardView {
  dimmed: boolean;
}

const MINUTES_PER_HOUR = 60;
const NO_TOPICS_YET = "No topics yet";

export function cardView(session: EnrichedCoachingSession, context: CardContext): CardView {
  const urgency = calculateSessionUrgency(session, context.now);
  const start = sessionStartIn(session.date, context.timezone);
  const tense = tenseOf(urgency);
  const topicCount = session.topics.some ? session.topics.val.length : 0;
  const participant = getSessionParticipantInfo(session, context.viewerId);
  return {
    session,
    start,
    name: participant?.participantName ?? "Unknown",
    tense,
    note: noteOf(urgency, minutesUntil(start, context.now), topicCount),
    footer: footerOf(urgency, topicCount),
    canManage: participant?.isCoach ?? false,
    editable: !sessionLocked(session, context.now, context.timezone),
  };
}

/** Ended, and not started on today's date in the zone: only Open session and Remove remain. */
export function sessionLocked(session: EnrichedCoachingSession, now: DateTime, timezone: string): boolean {
  const ended = calculateSessionUrgency(session, now) === SessionUrgency.Past;
  return ended && !sessionStartIn(session.date, timezone).hasSame(now.setZone(timezone), "day");
}

export function cardNoteText(note: CardNote): string {
  switch (note.kind) {
    case "relative":
      return `${note.text} · ${liveTopicsText(note.topicCount)}`;
    case "topics":
      return topicCountText(note.count);
    case "noTopics":
      return NO_TOPICS_YET;
    case "moved":
      return "Moved";
    default: {
      const _exhaustive: never = note;
      throw new Error(`Unhandled card note: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** A live card's topic status, flagged in the card when there are none. */
export function liveTopicsText(count: number): string {
  return count === 0 ? NO_TOPICS_YET : topicCountText(count);
}

export function markMoved(view: CardView): CardView {
  const tense = view.tense === CardTense.Live ? CardTense.Upcoming : view.tense;
  return { ...view, tense, note: { kind: "moved" } };
}

/** A card nobody can change: no reschedule, no drag, and a menu of Open session only. */
export function readOnlyView(view: CardView): CardView {
  return { ...view, canManage: false };
}

function tenseOf(urgency: SessionUrgency): CardTense {
  switch (urgency) {
    case SessionUrgency.Past:
      return CardTense.Past;
    case SessionUrgency.Underway:
    case SessionUrgency.Imminent:
    case SessionUrgency.Soon:
      return CardTense.Live;
    case SessionUrgency.Later:
      return CardTense.Upcoming;
    default: {
      const _exhaustive: never = urgency;
      throw new Error(`Unhandled session urgency: ${_exhaustive}`);
    }
  }
}

function noteOf(urgency: SessionUrgency, minutes: number, topicCount: number): CardNote {
  switch (urgency) {
    case SessionUrgency.Underway:
      return { kind: "relative", text: "now", pulse: true, topicCount };
    case SessionUrgency.Imminent:
    case SessionUrgency.Soon:
      return { kind: "relative", text: relativeStartText(minutes), pulse: true, topicCount };
    case SessionUrgency.Later:
      return topicCount > 0 ? { kind: "topics", count: topicCount } : { kind: "noTopics" };
    case SessionUrgency.Past:
      return { kind: "topics", count: topicCount };
    default: {
      const _exhaustive: never = urgency;
      throw new Error(`Unhandled session urgency: ${_exhaustive}`);
    }
  }
}

function footerOf(urgency: SessionUrgency, topicCount: number): CardFooter {
  if (urgency === SessionUrgency.Past) return CardFooter.Done;
  return isReady(topicCount) ? CardFooter.Ready : CardFooter.Prepare;
}

// Interim readiness rule (plan D3): any topic counts as prepared.
function isReady(topicCount: number): boolean {
  return topicCount >= 1;
}

function minutesUntil(start: DateTime, now: DateTime): number {
  return Math.round(start.diff(now, "minutes").minutes);
}

function relativeStartText(minutes: number): string {
  // Imminent covers the first minutes after the start too.
  if (minutes <= 0) return "now";
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `in ${rest} min`;
  return rest === 0 ? `in ${hours} hr` : `in ${hours} hr ${rest} min`;
}

function topicCountText(count: number): string {
  if (count === 0) return "No topics";
  return `${count} topic${count === 1 ? "" : "s"}`;
}
