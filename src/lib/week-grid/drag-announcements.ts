import type { DateTime } from "ts-luxon";
import { timeOfDay } from "@/lib/session-window";
import type { CardView } from "@/lib/week-grid/card";
import type { DropOutcome, DropTarget } from "@/lib/week-grid/slots";
import { type Option, None, Some } from "@/types/option";

export const CANCELLED_LINE = "Move cancelled.";

const dayTime = (start: DateTime) => `${start.toFormat("cccc")} ${timeOfDay(start)}`;

export function pickedUpLine(view: Pick<CardView, "name" | "start">): string {
  return `Picked up ${view.name}'s session at ${timeOfDay(view.start)}.`;
}

export function overLine(target: Option<DropTarget>): Option<string> {
  if (target.none) return None;
  if (target.val.kind === "day") return Some(`${target.val.day.toFormat("cccc")}.`);
  const { start, state } = target.val.slot;
  switch (state.kind) {
    case "free":
      return Some(`${dayTime(start)}, free.`);
    case "taken":
      return Some(`${dayTime(start)}, taken by ${state.holder}.`);
    case "current":
    case "past":
      return Some(`${start.toFormat("cccc")}.`);
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled slot state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** The first over after a pick-up also carries the pick-up line, since the live region keeps only its last message. */
export function overAnnouncement(pickup: Option<string>, target: Option<DropTarget>): Option<string> {
  const line = overLine(target);
  if (pickup.none) return line;
  return Some(line.some ? `${pickup.val} ${line.val}` : pickup.val);
}

export function droppedLine(outcome: DropOutcome): string {
  switch (outcome.kind) {
    case "move":
      return `Moved to ${dayTime(outcome.start)}.`;
    case "resolve":
      return "That time is taken. Opening reschedule.";
    case "ignore":
      return "Not moved.";
    default: {
      const _exhaustive: never = outcome;
      throw new Error(`Unhandled drop outcome: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
