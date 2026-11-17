import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddRelationshipDialog } from "@/components/ui/members/add-relationship-dialog";
import { toast } from "@/lib/toast";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { User } from "@/types/user";

const createNested = vi.fn();
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipMutation: () => ({ createNested }),
}));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const user = (id: string, first: string, last: string): User =>
  ({ id, first_name: first, last_name: last, email: `${first.toLowerCase()}@example.com` }) as User;

const CARA = user("cara", "Cara", "Test");
const PAT = user("pat", "Pat", "Coach");
const ANA = user("ana", "Ana", "Bell");
const PAT_COACHES_CARA = [{ coach_id: "pat", coachee_id: "cara" } as CoachingRelationshipWithUserNames];

function renderDialog(relationships: CoachingRelationshipWithUserNames[] = []) {
  const onClose = vi.fn();
  const onAdded = vi.fn();
  render(
    <AddRelationshipDialog
      organizationId="org-1"
      member={CARA}
      members={[CARA, PAT, ANA]}
      relationships={relationships}
      onClose={onClose}
      onAdded={onAdded}
    />
  );
  return { onClose, onAdded };
}

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));
const confirm = () => screen.getByRole("button", { name: "Pair them" });

describe("AddRelationshipDialog", () => {
  beforeEach(() => {
    // The phone layout, whose footer has a labelled Next button.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    createNested.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("adds a coach for the member", async () => {
    const { onClose, onAdded } = renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Coachee" }));
    next();
    expect(screen.getByRole("heading", { name: "Cara's coach" })).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Pat Coach/ }));
    fireEvent.click(confirm());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createNested).toHaveBeenCalledWith("org-1", { coach_id: "pat", coachee_id: "cara" });
    expect(toast.success).toHaveBeenCalledWith("Pat Coach is now Cara Test's coach");
    expect(onAdded).toHaveBeenCalled();
  });

  it("explains a role from its (i) without choosing it", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "About Coachee" }));

    expect(
      await screen.findByText("Meets with their coach, who schedules their sessions. Sees only the actions assigned to them.")
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Coachee" })).not.toBeChecked();
  });

  it("adds a coachee for the member", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Coach" }));
    next();
    fireEvent.click(screen.getByRole("button", { name: /Ana Bell/ }));
    fireEvent.click(confirm());
    await waitFor(() => expect(createNested).toHaveBeenCalledWith("org-1", { coach_id: "cara", coachee_id: "ana" }));
  });

  it("won't pick someone who already coaches the member", () => {
    renderDialog(PAT_COACHES_CARA);
    fireEvent.click(screen.getByRole("radio", { name: "Coachee" }));
    next();
    const pat = screen.getByRole("button", { name: /Pat Coach/ });
    expect(pat).toBeDisabled();
    expect(pat).toHaveTextContent("Already Cara's coach");
  });

  it("stays open with an error toast when the create fails", async () => {
    createNested.mockRejectedValue(new Error("Request failed"));
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Coachee" }));
    next();
    fireEvent.click(screen.getByRole("button", { name: /Pat Coach/ }));
    fireEvent.click(confirm());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't add the relationship"));
    expect(onClose).not.toHaveBeenCalled();
    expect(confirm()).toBeEnabled();
  });
});
