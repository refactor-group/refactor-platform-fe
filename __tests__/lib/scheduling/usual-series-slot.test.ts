import { describe, expect, it } from "vitest";
import { usualFor } from "@/lib/schedule-draft";
import { usualSlotLabel } from "@/lib/scheduling-copy";
import { toSessionDate } from "@/lib/session-window";
import {
  serializeCoachingSession,
  transformCoachingSession,
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { E_11, E_18, NOW, ZONE, at } from "./roster";

/** Ehab's next series session (Tue 2:30 PM), moved on its own to Wednesday 9:00 AM. */
const E_18_MOVED: EnrichedCoachingSession = {
  ...E_18,
  date: toSessionDate(at("2026-08-19T09:00")),
  ical_recurrence_id: Some(toSessionDate(at("2026-08-18T14:30"))),
};

const usualLabel = (sessions: EnrichedCoachingSession[]) => {
  const usual = usualFor(["rel-e"], sessions, NOW, ZONE);
  return usual.some ? usualSlotLabel(usual.val) : "none";
};

describe("usual slot for a series", () => {
  it("comes from the series slot, not where one session was moved", () => {
    expect(usualLabel([E_11, E_18_MOVED])).toBe("Usually Tuesdays, 2:30 PM");
  });

  it("follows the slot when the series itself moves", () => {
    const thursday = toSessionDate(at("2026-08-20T14:30"));
    const moved = { ...E_18, date: thursday, ical_recurrence_id: Some(thursday) };
    expect(usualLabel([E_11, moved])).toBe("Usually Thursdays, 2:30 PM");
  });

  it("uses the session's own start when the slot is unknown", () => {
    expect(usualLabel([E_11, { ...E_18, ical_recurrence_id: None }])).toBe("Usually Tuesdays, 2:30 PM");
  });
});

describe("ical_recurrence_id on the wire", () => {
  const raw = (value: string | null) => ({
    id: "s-1",
    coaching_relationship_id: "rel-e",
    date: "2026-08-19T14:00:00",
    duration_minutes: 50,
    title: null,
    coaching_session_series_id: "series-e",
    ical_recurrence_id: value,
    created_at: "2026-08-01T00:00:00",
    updated_at: "2026-08-01T00:00:00",
  });

  it("reads a slot as Some and null as None", () => {
    expect(transformCoachingSession(raw("2026-08-18T19:30:00")).ical_recurrence_id).toEqual(
      Some("2026-08-18T19:30:00")
    );
    expect(transformCoachingSession(raw(null)).ical_recurrence_id).toEqual(None);
    const { ical_recurrence_id: _absent, ...noField } = raw(null);
    expect(transformCoachingSession(noField).ical_recurrence_id).toEqual(None);
  });

  it("writes it back unchanged", () => {
    const slot = "2026-08-18T19:30:00";
    expect(serializeCoachingSession(transformCoachingSession(raw(slot))).ical_recurrence_id).toBe(slot);
    expect(serializeCoachingSession(transformCoachingSession(raw(null))).ical_recurrence_id).toBeNull();
  });
});
