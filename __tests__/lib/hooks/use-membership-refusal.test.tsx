import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { RefusedWrite } from "@/lib/membership-refusal";
import { None, Some } from "@/types/option";
import { Role, type UserRole } from "@/types/user";

vi.unmock("@/lib/hooks/use-membership-refusal");

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));

const session = vi.hoisted(() => ({ roles: [] as unknown[] }));
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ userSession: { roles: session.roles } }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-current" }),
}));

const { useMembershipRefusal } = await import("@/lib/hooks/use-membership-refusal");

const role = (r: Role, organizationId: string | null): UserRole =>
  ({ id: `${r}-${organizationId}`, role: r, organization_id: organizationId, user_id: "me" }) as UserRole;
// Refusals below come from org-1; the viewer is looking at org-current.
const admin = [role(Role.Admin, "org-1")];
const member = [role(Role.User, "org-1"), role(Role.Admin, "org-current")];

const refusal = (details: Record<string, unknown>) =>
  Object.assign(new Error("Request failed with status code 409"), {
    isAxiosError: true,
    response: { status: 409, statusText: "", data: { details }, headers: {}, config: {} },
  });

const coacheeLeft = refusal({ reason: "coachee_not_a_member", organization_id: "org-1", user_id: "u-1" });
const nameOf = () => Some("Maya Diaz");

describe("useMembershipRefusal", () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  it("offers an admin Add back, opening Add existing member in the refusal's organization", () => {
    session.roles = admin;
    const { result } = renderHook(() => useMembershipRefusal());

    expect(result.current(coacheeLeft, RefusedWrite.Resend, nameOf)).toBe(true);

    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe("Maya Diaz is no longer in this organization · Add Maya Diaz back to resend the invite");
    expect(options.action.label).toBe("Add back");
    options.action.onClick();
    expect(push).toHaveBeenCalledWith("/organizations/org-1/members?addMember=existing");
  });

  it("points a non-admin at an admin, with no button", () => {
    session.roles = member;
    const { result } = renderHook(() => useMembershipRefusal());

    result.current(coacheeLeft, RefusedWrite.Schedule, nameOf);

    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe("Maya Diaz is no longer in this organization · Ask an admin to add Maya Diaz back");
    expect(options.action).toBeUndefined();
  });

  it("passes the refused person's id to the name lookup", () => {
    session.roles = member;
    const lookup = vi.fn(() => None);
    const { result } = renderHook(() => useMembershipRefusal());

    result.current(coacheeLeft, RefusedWrite.Assign, lookup);

    expect(lookup).toHaveBeenCalledWith(Some("u-1"));
  });

  it("leaves any other error to the caller", () => {
    session.roles = admin;
    const { result } = renderHook(() => useMembershipRefusal());

    expect(result.current(refusal({ reason: "series_member" }), RefusedWrite.Resend, nameOf)).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("decides Add back by the refused organization, not the one being viewed", () => {
    session.roles = member; // admin only of org-current
    const { result } = renderHook(() => useMembershipRefusal());
    result.current(coacheeLeft, RefusedWrite.Resend, nameOf);
    expect(toast.error.mock.calls[0][1].action).toBeUndefined();

    session.roles = admin; // admin of org-1 while viewing org-current
    const { result: asAdmin } = renderHook(() => useMembershipRefusal());
    asAdmin.current(coacheeLeft, RefusedWrite.Resend, nameOf);
    expect(toast.error.mock.calls[1][1].action.label).toBe("Add back");
  });

  it("falls back to the current organization when the refusal names none", () => {
    session.roles = [role(Role.Admin, "org-current")];
    const { result } = renderHook(() => useMembershipRefusal());

    result.current(refusal({ reason: "coachee_not_a_member" }), RefusedWrite.Schedule, nameOf);

    const [, options] = toast.error.mock.calls[0];
    options.action.onClick();
    expect(push).toHaveBeenCalledWith("/organizations/org-current/members?addMember=existing");
  });

  it("offers a SuperAdmin Add back anywhere", () => {
    session.roles = [role(Role.SuperAdmin, null)];
    const { result } = renderHook(() => useMembershipRefusal());
    result.current(coacheeLeft, RefusedWrite.Assign, nameOf);
    expect(toast.error.mock.calls[0][1].action.label).toBe("Add back");
  });
});
