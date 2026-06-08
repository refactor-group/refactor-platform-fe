// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// Pins the Phase 2 API-layer wire behavior for the session Title: every READ
// path normalizes the raw wire `title: string | null` into Option<string>, and
// every WRITE path serializes Option<string> back to a raw string | null — so
// the Option wrapper object can NEVER leak onto the wire. Guards the
// interaction bug introduced by adding an Option field to a directly-POSTed
// entity. Mirrors the EntityApi-mocking style of the Phase 1 topics test.
//
// Read-only (chmod 0444), on the freeze list: an IMPLEMENTER must NOT edit it.
// Only the overseer may unlock it for a genuine spec/harness error.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoachingSessionApi } from "@/lib/api/coaching-sessions";
import { defaultCoachingSession } from "@/types/coaching-session";
import { Some, None } from "@/types/option";
import { EntityApi } from "@/lib/api/entity-api";

vi.mock("@/lib/api/entity-api", () => ({
  EntityApi: {
    getFn: vi.fn(),
    listFn: vi.fn(),
    listNestedFn: vi.fn(),
    createFn: vi.fn(),
    updateFn: vi.fn(),
    deleteFn: vi.fn(),
    useEntity: vi.fn(),
    useEntityList: vi.fn(),
    useEntityMutation: vi.fn(),
  },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

vi.mock("@/lib/api/users", () => ({
  USERS_BASEURL: "http://localhost:3000/users",
}));

// A raw wire session (title is a plain string | null on the wire).
const rawWith = (title: string | null) => ({
  id: "s1",
  coaching_relationship_id: "r1",
  date: "2026-06-05T15:00:00",
  duration_minutes: 60,
  created_at: "2026-05-01T12:00:00Z",
  updated_at: "2026-05-02T09:30:00Z",
  title,
});

describe("CoachingSessionApi reads normalize wire title -> Option<string>", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get wraps a string title as Some", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue(rawWith("Strategy sync"));
    const s = await CoachingSessionApi.get("s1");
    expect(s.title.some).toBe(true);
    expect(s.title.some && s.title.val).toBe("Strategy sync");
  });

  it("get wraps a null title as None", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue(rawWith(null));
    const s = await CoachingSessionApi.get("s1");
    expect(s.title.none).toBe(true);
  });

  it("list maps the transform across every row", async () => {
    vi.mocked(EntityApi.listFn).mockResolvedValue([rawWith("A"), rawWith(null)]);
    const list = await CoachingSessionApi.list(
      "r1",
      // fromDate / toDate are DateTime; the API only calls .toISODate() on them.
      { toISODate: () => "2026-06-01" } as never,
      { toISODate: () => "2026-06-30" } as never
    );
    expect(list[0].title.some && list[0].title.val).toBe("A");
    expect(list[1].title.none).toBe(true);
  });

  it("listNested maps the transform across every enriched row", async () => {
    vi.mocked(EntityApi.listNestedFn).mockResolvedValue([rawWith("A"), rawWith(null)]);
    const list = await CoachingSessionApi.listNested("u1");
    expect(list[0].title.some && list[0].title.val).toBe("A");
    expect(list[1].title.none).toBe(true);
  });
});

describe("CoachingSessionApi writes serialize Option<string> -> wire string | null", () => {
  beforeEach(() => vi.clearAllMocks());

  it("update sends Some(title) as a raw string, never the Option wrapper", async () => {
    vi.mocked(EntityApi.updateFn).mockResolvedValue(rawWith("Renamed"));
    await CoachingSessionApi.update("s1", {
      ...defaultCoachingSession(),
      id: "s1",
      title: Some("Renamed"),
    });
    const body = vi.mocked(EntityApi.updateFn).mock.calls[0][1] as { title: unknown };
    expect(body.title).toBe("Renamed");
  });

  it("update sends None as null", async () => {
    vi.mocked(EntityApi.updateFn).mockResolvedValue(rawWith(null));
    await CoachingSessionApi.update("s1", {
      ...defaultCoachingSession(),
      id: "s1",
      title: None,
    });
    const body = vi.mocked(EntityApi.updateFn).mock.calls[0][1] as { title: unknown };
    expect(body.title).toBe(null);
  });

  it("update transforms the response back into Option<string>", async () => {
    vi.mocked(EntityApi.updateFn).mockResolvedValue(rawWith("Renamed"));
    const s = await CoachingSessionApi.update("s1", {
      ...defaultCoachingSession(),
      id: "s1",
      title: Some("Renamed"),
    });
    expect(s.title.some && s.title.val).toBe("Renamed");
  });

  it("create sends Some(title) as a raw string", async () => {
    vi.mocked(EntityApi.createFn).mockResolvedValue(rawWith("New session"));
    await CoachingSessionApi.create({
      ...defaultCoachingSession(),
      title: Some("New session"),
    });
    const body = vi.mocked(EntityApi.createFn).mock.calls[0][1] as { title: unknown };
    expect(body.title).toBe("New session");
  });

  it("create sends None as null", async () => {
    vi.mocked(EntityApi.createFn).mockResolvedValue(rawWith(null));
    await CoachingSessionApi.create({ ...defaultCoachingSession(), title: None });
    const body = vi.mocked(EntityApi.createFn).mock.calls[0][1] as { title: unknown };
    expect(body.title).toBe(null);
  });

  // The backend returns 204 / `data: null` on PUT — transforming that must not
  // throw (regression: it crashed reschedule + title-save against the live BE).
  it("tolerates an empty (204/null) update response without throwing", async () => {
    vi.mocked(EntityApi.updateFn).mockResolvedValue(null as never);
    const s = await CoachingSessionApi.update("s1", {
      ...defaultCoachingSession(),
      id: "s1",
      title: Some("Renamed"),
    });
    expect(s.title.none).toBe(true);
  });
});
