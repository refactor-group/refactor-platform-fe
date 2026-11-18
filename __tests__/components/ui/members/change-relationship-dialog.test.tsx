import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChangeRelationshipDialog } from "@/components/ui/members/change-relationship-dialog";
import { toast } from "@/lib/toast";
import { EntityApiError } from "@/types/entity-api-error";
import { type CoachingRelationshipWithUserNames, RelationshipKind } from "@/types/coaching-relationship";
import type { User } from "@/types/user";

const changeKind = vi.fn();
vi.mock("@/lib/api/coaching-relationships", () => ({
  CoachingRelationshipApi: {
    changeKind: (...args: unknown[]) => changeKind(...args),
    list: vi.fn(async () => []),
  },
}));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
const showNotAMember = vi.fn();
vi.mock("@/lib/hooks/use-not-a-member-toast", () => ({ useNotAMemberToast: () => showNotAMember }));

const CARA = { id: "cara", first_name: "Cara", last_name: "Test", email: "cara@example.com" } as User;
const PAT_COACHES_CARA = {
  id: "rel-1",
  coach_id: "pat",
  coach_first_name: "Pat",
  coach_last_name: "Coach",
  coachee_id: "cara",
  coachee_first_name: "Cara",
  coachee_last_name: "Test",
  kind: RelationshipKind.Coaching,
  coach_is_member: true,
  coachee_is_member: true,
} as CoachingRelationshipWithUserNames;

const conflict = (details: Record<string, unknown>) =>
  new EntityApiError(
    "PUT",
    "/organizations/org-1/coaching_relationships/rel-1/kind",
    Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      response: { status: 409, data: { error: "conflict", details } },
    })
  );

const NEEDS_CONFIRMATION = conflict({
  reason: "kind_switch_needs_confirmation",
  actions_becoming_visible: [{ user_id: "cara", by_assignee: [{ assignee_id: "pat", count: 3 }] }],
  scheduling_gained: ["cara"],
  scheduling_lost: [],
});

function renderDialog() {
  const onClose = vi.fn();
  const onRelationshipsChanged = vi.fn();
  const dialog = (relationships: CoachingRelationshipWithUserNames[]) => (
    <ChangeRelationshipDialog
      organizationId="org-1"
      member={CARA}
      relationships={relationships}
      onClose={onClose}
      onRelationshipsChanged={onRelationshipsChanged}
    />
  );
  const view = render(dialog([PAT_COACHES_CARA]));
  return {
    onClose,
    onRelationshipsChanged,
    rerender: (relationships: CoachingRelationshipWithUserNames[]) => view.rerender(dialog(relationships)),
    unmount: view.unmount,
  };
}

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));

function makeCaraPatsColleague() {
  fireEvent.click(screen.getByRole("button", { name: /Pat Coach/ }));
  next();
  fireEvent.click(screen.getByRole("radio", { name: "Colleague" }));
  next();
}

describe("ChangeRelationshipDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    changeKind.mockReset();
    showNotAMember.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("previews the consequences, then confirms the switch", async () => {
    changeKind.mockRejectedValueOnce(NEEDS_CONFIRMATION).mockResolvedValueOnce(PAT_COACHES_CARA);
    const { onClose, onRelationshipsChanged } = renderDialog();
    makeCaraPatsColleague();

    expect(await screen.findByText("Cara Test will see 3 actions assigned to Pat Coach")).toBeInTheDocument();
    expect(screen.getByText("Cara Test will be able to schedule sessions")).toBeInTheDocument();
    expect(changeKind).toHaveBeenCalledWith("org-1", "rel-1", { kind: "colleague", confirmed: false });

    fireEvent.click(screen.getByRole("button", { name: "Change relationship" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(changeKind).toHaveBeenLastCalledWith("org-1", "rel-1", { kind: "colleague", confirmed: true });
    expect(toast.success).toHaveBeenCalledWith("Cara Test and Pat Coach are now colleagues");
    expect(onRelationshipsChanged).toHaveBeenCalled();
  });

  it("starts on the current role and waits for a different one", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Pat Coach/ }));
    next();
    expect(screen.getByRole("radio", { name: "Coachee (current)" })).toBeChecked();
    expect(screen.getByText("Choose a different role")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Coach" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("sends who coaches when reversing", async () => {
    changeKind.mockRejectedValueOnce(NEEDS_CONFIRMATION);
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Pat Coach/ }));
    next();
    fireEvent.click(screen.getByRole("radio", { name: "Coach" }));
    next();
    await screen.findByText("Cara Test will coach Pat Coach");
    expect(changeKind).toHaveBeenCalledWith("org-1", "rel-1", { kind: "coaching", coach_id: "cara", confirmed: false });
  });

  it("names who left and closes", async () => {
    changeKind.mockRejectedValueOnce(
      conflict({ reason: "participant_not_a_member", user_id: "pat", organization_id: "org-1" })
    );
    const { onClose } = renderDialog();
    makeCaraPatsColleague();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [refusal, , nameOf] = showNotAMember.mock.calls[0];
    expect(refusal.userId).toEqual({ some: true, none: false, val: "pat" });
    expect(nameOf(refusal.userId)).toMatchObject({ some: true, val: "Pat Coach" });
  });

  it("says the organization is archived", async () => {
    changeKind.mockRejectedValueOnce(
      new EntityApiError(
        "PUT",
        "/organizations/org-1/coaching_relationships/rel-1/kind",
        Object.assign(new Error("Request failed"), {
          isAxiosError: true,
          response: { status: 409, data: { error: "organization_archived" } },
        })
      )
    );
    const { onClose } = renderDialog();
    makeCaraPatsColleague();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This organization is archived · It can't be changed")
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the organization is archived between review and confirm", async () => {
    changeKind.mockRejectedValueOnce(NEEDS_CONFIRMATION).mockRejectedValueOnce(
      new EntityApiError(
        "PUT",
        "/organizations/org-1/coaching_relationships/rel-1/kind",
        Object.assign(new Error("Request failed"), {
          isAxiosError: true,
          response: { status: 409, data: { error: "organization_archived" } },
        })
      )
    );
    const { onClose } = renderDialog();
    makeCaraPatsColleague();
    await screen.findByText("Cara Test will see 3 actions assigned to Pat Coach");

    fireEvent.click(screen.getByRole("button", { name: "Change relationship" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("This organization is archived · It can't be changed");
  });

  it("goes back to the role when the relationship changes during the review", async () => {
    changeKind.mockRejectedValueOnce(NEEDS_CONFIRMATION);
    const { rerender } = renderDialog();
    makeCaraPatsColleague();
    await screen.findByText("Cara Test will see 3 actions assigned to Pat Coach");

    // Another admin made them colleagues meanwhile.
    rerender([{ ...PAT_COACHES_CARA, kind: RelationshipKind.Colleague }]);
    expect(screen.getByRole("radio", { name: "Colleague (current)" })).toBeChecked();
    expect(screen.getByText("Choose a different role")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change relationship" })).not.toBeInTheDocument();
  });

  it("says nothing about an answer that lands after the dialog closed", async () => {
    let answer: (error: unknown) => void = () => {};
    changeKind.mockReturnValueOnce(new Promise((_, reject) => (answer = reject)));
    const { unmount } = renderDialog();
    makeCaraPatsColleague();
    unmount();
    answer(conflict({ reason: "participant_not_a_member", user_id: "pat", organization_id: "org-1" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(showNotAMember).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
