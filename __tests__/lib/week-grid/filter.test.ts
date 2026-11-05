import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some } from "@/types/option";
import type { PersonEntry } from "@/lib/people";
import type { PersonActivity } from "@/lib/person-activity";
import {
  PersonGroup,
  filterLabel,
  filterPeople,
  filterSections,
  isFilteredOut,
  type FilterPerson,
} from "@/lib/week-grid/filter";
import { createMockEnrichedSession } from "../../test-utils";

const entry = (userId: string, fullName: string, relationshipIds: string[]): PersonEntry => ({
  person: { userId, firstName: fullName.split(" ")[0], fullName, initials: "XX" },
  relationshipIds,
});
const ALEX = entry("u-alex", "Alex Chen", ["rel-alex"]);
const ERIN = entry("u-erin", "Erin Park", ["rel-erin"]);
const SAM = entry("u-sam", "Sam Ruiz", ["rel-sam-1", "rel-sam-2"]);

const upcoming: PersonActivity = {
  kind: "upcoming",
  next: { start: DateTime.fromISO("2026-08-20T10:00:00"), over: false, relationshipId: "rel-alex" },
};
const inactive: PersonActivity = { kind: "inactive", last: None };

describe("filterPeople", () => {
  it("puts everyone under Coachees until activity is known", () => {
    expect(filterPeople([ALEX, ERIN], None).map((p) => p.group)).toEqual([
      PersonGroup.Coachees,
      PersonGroup.Coachees,
    ]);
  });

  it("moves inactive people to Inactive, keeping name order and relationships", () => {
    const activity = new Map([
      ["u-alex", upcoming],
      ["u-erin", inactive],
      ["u-sam", upcoming],
    ]);
    expect(filterPeople([ALEX, ERIN, SAM], Some(activity))).toEqual([
      { userId: "u-alex", fullName: "Alex Chen", relationshipIds: ["rel-alex"], group: PersonGroup.Coachees },
      { userId: "u-erin", fullName: "Erin Park", relationshipIds: ["rel-erin"], group: PersonGroup.Inactive },
      { userId: "u-sam", fullName: "Sam Ruiz", relationshipIds: ["rel-sam-1", "rel-sam-2"], group: PersonGroup.Coachees },
    ]);
  });
});

const people: FilterPerson[] = [
  { userId: "u-alex", fullName: "Alex Chen", relationshipIds: ["rel-alex"], group: PersonGroup.Coachees },
  { userId: "u-erin", fullName: "Erin Park", relationshipIds: ["rel-erin"], group: PersonGroup.Inactive },
  { userId: "u-sam", fullName: "Sam Ruiz", relationshipIds: ["rel-sam-1", "rel-sam-2"], group: PersonGroup.Coachees },
];

describe("filterSections", () => {
  it("lists Coachees then Inactive, each labelled", () => {
    expect(filterSections(people, "").map((s) => [s.label, s.people.map((p) => p.userId)])).toEqual([
      ["Coachees", ["u-alex", "u-sam"]],
      ["Inactive", ["u-erin"]],
    ]);
  });

  it("narrows by any part of the name, ignoring case and spaces around it", () => {
    expect(filterSections(people, "  CHE ").map((s) => s.people.map((p) => p.userId))).toEqual([["u-alex"]]);
  });

  it("drops a group with no match, and returns nothing when no one matches", () => {
    expect(filterSections(people, "park").map((s) => s.group)).toEqual([PersonGroup.Inactive]);
    expect(filterSections(people, "zzz")).toEqual([]);
  });
});

describe("isFilteredOut", () => {
  const sams = createMockEnrichedSession({ coaching_relationship_id: "rel-sam-2" });
  const alexs = createMockEnrichedSession({ coaching_relationship_id: "rel-alex" });

  it("keeps everything without a filter", () => {
    expect(isFilteredOut(alexs, None)).toBe(false);
  });

  it("keeps any of the person's relationships and filters out the rest", () => {
    expect(isFilteredOut(sams, Some(people[2]))).toBe(false);
    expect(isFilteredOut(alexs, Some(people[2]))).toBe(true);
  });
});

describe("filterLabel", () => {
  it("reads All sessions, or the selected person's name", () => {
    expect(filterLabel(None)).toBe("All sessions");
    expect(filterLabel(Some(people[0]))).toBe("Alex Chen");
  });
});
