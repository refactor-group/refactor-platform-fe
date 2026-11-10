import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { DateTime } from "ts-luxon";
import { server } from "@/test-utils/msw-server";
import { writeSessionMove } from "@/lib/session-move";

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:4000", backendApiVersion: "1.0.0-test" } },
}));

describe("writeSessionMove", () => {
  it("sends only the new start and duration, so it never writes back a stale copy of the session", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.put("http://localhost:4000/coaching_sessions/s-1", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ status_code: 200, data: {} });
      })
    );
    await writeSessionMove("s-1", DateTime.fromISO("2026-08-20T10:00", { zone: "America/Chicago" }), 50);
    expect(bodies).toEqual([{ date: "2026-08-20T15:00:00", duration_minutes: 50 }]);
  });
});
