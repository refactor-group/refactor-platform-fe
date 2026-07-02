import { describe, it, expect } from "vitest";
import {
  defaultOrganization,
  isOrganizationArchived,
  OrganizationStatusFilter,
} from "@/types/organization";

describe("isOrganizationArchived", () => {
  it("is false when archived_at is absent (active)", () => {
    expect(isOrganizationArchived(defaultOrganization())).toBe(false);
  });

  it("is true when archived_at is a timestamp", () => {
    const org = { ...defaultOrganization(), archived_at: "2026-01-01T00:00:00Z" };
    expect(isOrganizationArchived(org)).toBe(true);
  });

  it("is false when archived_at is null off the wire", () => {
    // backend serializes present-but-null; loose != null must treat it as active
    const org = { ...defaultOrganization(), archived_at: null } as never;
    expect(isOrganizationArchived(org)).toBe(false);
  });
});

describe("defaultOrganization", () => {
  it("is active (no archived_at)", () => {
    expect(defaultOrganization().archived_at).toBeUndefined();
  });
});

describe("OrganizationStatusFilter", () => {
  it("maps to the backend ?status= values", () => {
    expect(OrganizationStatusFilter.Active).toBe("active");
    expect(OrganizationStatusFilter.Archived).toBe("archived");
    expect(OrganizationStatusFilter.All).toBe("all");
  });
});
