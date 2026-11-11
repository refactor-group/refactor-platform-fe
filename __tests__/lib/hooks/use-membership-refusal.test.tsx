import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { RefusedWrite } from "@/lib/membership-refusal";
import { None, Some } from "@/types/option";
import { Role, type UserRoleState } from "@/types/user";

vi.unmock("@/lib/hooks/use-membership-refusal");

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));

const roleState = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/hooks/use-current-user-role", () => ({ useCurrentUserRole: () => roleState.current }));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-current" }),
}));

const { useMembershipRefusal } = await import("@/lib/hooks/use-membership-refusal");

const admin: UserRoleState = { status: "success", role: Role.Admin, hasAccess: true };
const member: UserRoleState = { status: "success", role: Role.User, hasAccess: true };

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
    roleState.current = admin;
    const { result } = renderHook(() => useMembershipRefusal());

    expect(result.current(coacheeLeft, RefusedWrite.Resend, nameOf)).toBe(true);

    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe("Maya Diaz is no longer in this organization · Add Maya Diaz back to resend the invite");
    expect(options.action.label).toBe("Add back");
    options.action.onClick();
    expect(push).toHaveBeenCalledWith("/organizations/org-1/members?addMember=existing");
  });

  it("points a non-admin at an admin, with no button", () => {
    roleState.current = member;
    const { result } = renderHook(() => useMembershipRefusal());

    result.current(coacheeLeft, RefusedWrite.Schedule, nameOf);

    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe("Maya Diaz is no longer in this organization · Ask an admin to add Maya Diaz back");
    expect(options.action).toBeUndefined();
  });

  it("passes the refused person's id to the name lookup", () => {
    roleState.current = member;
    const lookup = vi.fn(() => None);
    const { result } = renderHook(() => useMembershipRefusal());

    result.current(coacheeLeft, RefusedWrite.Assign, lookup);

    expect(lookup).toHaveBeenCalledWith(Some("u-1"));
  });

  it("leaves any other error to the caller", () => {
    roleState.current = admin;
    const { result } = renderHook(() => useMembershipRefusal());

    expect(result.current(refusal({ reason: "series_member" }), RefusedWrite.Resend, nameOf)).toBe(false);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
