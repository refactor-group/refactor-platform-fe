import { describe, it, expect } from "vitest";
import {
  defaultOrganization,
  isOrganizationArchived,
  OrganizationStatusFilter,
} from "@/types/organization";

describe("isOrganizationArchived", () => {
  it("is false when archived_at is null", () => {
    expect(isOrganizationArchived(defaultOrganization())).toBe(false);
  });

  it("is true when archived_at is a timestamp", () => {
    const org = { ...defaultOrganization(), archived_at: "2026-01-01T00:00:00Z" };
    expect(isOrganizationArchived(org)).toBe(true);
  });

  it("is false when archived_at is absent (backend hasn't shipped the field yet)", () => {
    const { archived_at, ...withoutField } = defaultOrganization();
    expect(isOrganizationArchived(withoutField as never)).toBe(false);
  });
});

describe("defaultOrganization", () => {
  it("defaults archived_at to null (active)", () => {
    expect(defaultOrganization().archived_at).toBeNull();
  });
});

describe("OrganizationStatusFilter", () => {
  it("maps to the backend ?status= values", () => {
    expect(OrganizationStatusFilter.Active).toBe("active");
    expect(OrganizationStatusFilter.Archived).toBe("archived");
    expect(OrganizationStatusFilter.All).toBe("all");
  });
});
