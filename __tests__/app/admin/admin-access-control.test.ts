import { describe, it, expect } from "vitest";
import { isSuperAdmin, Role } from "@/types/user";
import type { UserRole } from "@/types/user";
import { shouldDenyAdminAccess } from "@/app/admin/admin-access-control";

function makeRole(overrides: Partial<UserRole>): UserRole {
  return {
    id: "role-1",
    user_id: "user-1",
    role: Role.User,
    organization_id: "org-1",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    ...overrides,
  };
}

const superAdminRole = makeRole({ role: Role.SuperAdmin, organization_id: null });
const orgAdminRole = makeRole({ role: Role.Admin, organization_id: "org-1" });
const userRole = makeRole({ role: Role.User, organization_id: "org-1" });

describe("isSuperAdmin", () => {
  it("returns true for a system SuperAdmin (organization_id === null)", () => {
    expect(isSuperAdmin([superAdminRole])).toBe(true);
  });

  it("returns false for an org-scoped Admin", () => {
    expect(isSuperAdmin([orgAdminRole])).toBe(false);
  });

  it("returns false for a plain User", () => {
    expect(isSuperAdmin([userRole])).toBe(false);
  });

  it("returns false for an empty roles array", () => {
    expect(isSuperAdmin([])).toBe(false);
  });

  it("returns false for an org-scoped SuperAdmin (organization_id set)", () => {
    expect(
      isSuperAdmin([makeRole({ role: Role.SuperAdmin, organization_id: "org-1" })])
    ).toBe(false);
  });

  it("detects the SuperAdmin role among multiple assignments", () => {
    expect(isSuperAdmin([userRole, orgAdminRole, superAdminRole])).toBe(true);
  });
});

describe("shouldDenyAdminAccess", () => {
  it("allows access (returns false) only for SuperAdmins", () => {
    expect(shouldDenyAdminAccess([superAdminRole], true)).toBe(false);
  });

  it("does not deny while signed out, so logging out cannot flash a 404", () => {
    // Signing out clears the session before the redirect lands, so the page
    // re-renders unauthenticated while still mounted. Authentication is the
    // auth layer's to handle; 404ing here flashes on the way to login.
    expect(shouldDenyAdminAccess([superAdminRole], false)).toBe(false);
    expect(shouldDenyAdminAccess([], false)).toBe(false);
  });

  it("denies org Admins, plain Users, and empty roles", () => {
    expect(shouldDenyAdminAccess([orgAdminRole], true)).toBe(true);
    expect(shouldDenyAdminAccess([userRole], true)).toBe(true);
    expect(shouldDenyAdminAccess([], true)).toBe(true);
  });
});
