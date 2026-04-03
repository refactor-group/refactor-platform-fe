import { describe, it, expect } from "vitest";
import { buildQueryString } from "@/lib/api/query-params";

describe("buildQueryString", () => {
  it("builds a query string, omitting null and undefined values", () => {
    const result = buildQueryString({
      assignee: "coachee",
      assignee_filter: undefined,
      status: "active",
      sort_by: null,
      sort_order: "asc",
    });
    expect(result).toBe("?assignee=coachee&status=active&sort_order=asc");
  });
});
