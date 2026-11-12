import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { AddBackPurpose } from "@/lib/api/membership-errors";
import { NotAMemberReason, type NotAMemberRefusal } from "@/types/membership";
import { None, Some } from "@/types/option";
import { Role, type UserRole } from "@/types/user";

vi.unmock("@/lib/hooks/use-not-a-member-toast");

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast }));

const session = vi.hoisted(() => ({ roles: [] as unknown[] }));
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ userSession: { roles: session.roles } }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-current" }),
}));

const { useNotAMemberToast } = await import("@/lib/hooks/use-not-a-member-toast");

const role = (r: Role, organizationId: string | null): UserRole =>
  ({ id: `${r}-${organizationId}`, role: r, organization_id: organizationId, user_id: "me" }) as UserRole;
// Refusals below come from org-1; the viewer is looking at org-current.
const adminOfRefused = [role(Role.Admin, "org-1")];
const adminOfViewed = [role(Role.User, "org-1"), role(Role.Admin, "org-current")];

const coacheeRefusal: NotAMemberRefusal = {
  reason: NotAMemberReason.Coachee,
  userId: Some("u-1"),
  organizationId: Some("org-1"),
};
const nameOf = () => Some("Maya Diaz");

function show(roles: UserRole[], refusal = coacheeRefusal, purpose = AddBackPurpose.ResendInvite, lookup = nameOf) {
  session.roles = roles;
  const { result } = renderHook(() => useNotAMemberToast());
  result.current(refusal, purpose, lookup);
  const [message, options] = toast.error.mock.calls.at(-1)!;
  return { message, action: options.action as { label: string; onClick: () => void } | undefined };
}

describe("useNotAMemberToast", () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  });

  it("offers an admin Add back, opening Add existing member in the refusal's organization", () => {
    const { message, action } = show(adminOfRefused);

    expect(message).toBe("Maya Diaz is no longer in this organization · Add Maya Diaz back to resend the invite");
    expect(action?.label).toBe("Add back");
    action?.onClick();
    expect(push).toHaveBeenCalledWith("/organizations/org-1/members?addMember=existing");
  });

  it("points anyone else at an admin, with no button", () => {
    const { message, action } = show([role(Role.User, "org-1")], coacheeRefusal, AddBackPurpose.ScheduleSessions);

    expect(message).toBe("Maya Diaz is no longer in this organization · Ask an admin to add Maya Diaz back");
    expect(action).toBeUndefined();
  });

  it("passes the refused person's id to the name lookup", () => {
    const lookup = vi.fn(() => None);
    show(adminOfViewed, coacheeRefusal, AddBackPurpose.AssignActions, lookup);
    expect(lookup).toHaveBeenCalledWith(Some("u-1"));
  });

  it("decides Add back by the refused organization, not the one being viewed", () => {
    expect(show(adminOfViewed).action).toBeUndefined();
    expect(show(adminOfRefused).action?.label).toBe("Add back");
  });

  it("falls back to the current organization when the refusal names none", () => {
    const { action } = show(
      [role(Role.Admin, "org-current")],
      { ...coacheeRefusal, organizationId: None },
      AddBackPurpose.ScheduleSessions
    );
    action?.onClick();
    expect(push).toHaveBeenCalledWith("/organizations/org-current/members?addMember=existing");
  });

  it("offers a SuperAdmin Add back anywhere", () => {
    expect(show([role(Role.SuperAdmin, null)]).action?.label).toBe("Add back");
  });
});
