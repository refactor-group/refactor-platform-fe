import { describe, it, expect } from "vitest";
import {
  defaultOrganization,
  isOrganizationArchived,
  organizationInitials,
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

describe("organizationInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(organizationInitials("Refactor Group")).toBe("RG");
    expect(organizationInitials("Big Table Industries")).toBe("BT");
  });

  it("takes the first two letters of a single-word name", () => {
    expect(organizationInitials("BigTable")).toBe("BI");
    expect(organizationInitials("Acme")).toBe("AC");
  });

  it("varies with the name rather than returning a fixed value", () => {
    const initials = ["Refactor Group", "BigTable", "Zeta Labs"].map(
      organizationInitials
    );
    expect(new Set(initials).size).toBe(3);
  });

  it("uppercases lowercase names", () => {
    expect(organizationInitials("acme corp")).toBe("AC");
  });

  it("does not pad a one-letter name", () => {
    expect(organizationInitials("X")).toBe("X");
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(organizationInitials("  Refactor   Group  ")).toBe("RG");
  });

  it("falls back to ? for an empty or missing name", () => {
    expect(organizationInitials("")).toBe("?");
    expect(organizationInitials("   ")).toBe("?");
    expect(organizationInitials(undefined)).toBe("?");
  });
});

describe("OrganizationStatusFilter", () => {
  it("maps to the backend ?status= values", () => {
    expect(OrganizationStatusFilter.Active).toBe("active");
    expect(OrganizationStatusFilter.Archived).toBe("archived");
    expect(OrganizationStatusFilter.All).toBe("all");
  });
});
