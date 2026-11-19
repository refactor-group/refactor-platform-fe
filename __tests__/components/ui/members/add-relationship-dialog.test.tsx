import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddRelationshipDialog } from "@/components/ui/members/add-relationship-dialog";
import { toast } from "@/lib/toast";
import { EntityApiError } from "@/types/entity-api-error";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { User } from "@/types/user";
import { createMockRelationship } from "../../../test-utils";

const createNested = vi.fn();
const listRelationships = vi.fn();
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipMutation: () => ({ createNested }),
  CoachingRelationshipApi: { list: (...args: unknown[]) => listRelationships(...args) },
}));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

const user = (id: string, first: string, last: string): User =>
  ({ id, first_name: first, last_name: last, email: `${first.toLowerCase()}@example.com` }) as User;

const CARA = user("cara", "Cara", "Test");
const PAT = user("pat", "Pat", "Coach");
const ANA = user("ana", "Ana", "Bell");
const patCoachesCara = (id = "rel-1") =>
  createMockRelationship({ id, coach_id: PAT.id, coachee_id: CARA.id }, { coach: PAT, coachee: CARA });
const PAT_COACHES_CARA = [patCoachesCara()];

function renderDialog(relationships: CoachingRelationshipWithUserNames[] = []) {
  const onClose = vi.fn();
  const onRelationshipsChanged = vi.fn();
  render(
    <AddRelationshipDialog
      organizationId="org-1"
      member={CARA}
      members={[CARA, PAT, ANA]}
      relationships={relationships}
      onClose={onClose}
      onRelationshipsChanged={onRelationshipsChanged}
    />
  );
  return { onClose, onRelationshipsChanged };
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
    const { onClose, onRelationshipsChanged } = renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Coachee" }));
    next();
    expect(screen.getByRole("heading", { name: "Choose Cara's coach" })).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Pat Coach/ }));
    fireEvent.click(confirm());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createNested).toHaveBeenCalledWith("org-1", { coach_id: "pat", coachee_id: "cara", kind: "coaching" });
    expect(toast.success).toHaveBeenCalledWith("Pat Coach is now Cara Test's coach");
    expect(onRelationshipsChanged).toHaveBeenCalled();
  });

  it("explains a role from its (i) without choosing it", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "About Coachee" }));

    expect(
      await screen.findByText("Meets with their coach, who schedules their sessions. Sees only the actions assigned to them.")
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Coachee" })).not.toBeChecked();
  });

  it("asks for a role before moving on to the person", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.getByText("Choose a role first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Coachee" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("adds a coachee for the member", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Coach" }));
    next();
    fireEvent.click(screen.getByRole("button", { name: /Ana Bell/ }));
    fireEvent.click(confirm());
    await waitFor(() =>
      expect(createNested).toHaveBeenCalledWith("org-1", { coach_id: "cara", coachee_id: "ana", kind: "coaching" })
    );
  });

  it("makes the member and the partner colleagues", async () => {
    const { onClose } = renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: "Colleague" }));
    next();
    expect(screen.getByRole("heading", { name: "Choose Cara's colleague" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ana Bell/ }));
    expect(screen.getByText("Cara Test and Ana Bell will be colleagues")).toBeInTheDocument();
    fireEvent.click(confirm());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createNested).toHaveBeenCalledWith("org-1", { coach_id: "cara", coachee_id: "ana", kind: "colleague" });
    expect(toast.success).toHaveBeenCalledWith("Cara Test and Ana Bell are now colleagues");
  });

  it("won't pick someone in a coaching relationship with the member as a colleague", () => {
    renderDialog(PAT_COACHES_CARA);
    fireEvent.click(screen.getByRole("radio", { name: "Colleague" }));
    next();
    expect(screen.getByRole("button", { name: /Pat Coach/ })).toBeDisabled();
  });

  const alreadyRelated = (details: Record<string, unknown>) =>
    new EntityApiError(
      "POST",
      "/organizations/org-1/coaching_relationships",
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 409, data: { error: "conflict", details: { reason: "pair_already_related", ...details } } },
      })
    );

  const pairCaraWithPatAsColleagues = () => {
    fireEvent.click(screen.getByRole("radio", { name: "Colleague" }));
    next();
    fireEvent.click(screen.getByRole("button", { name: /Pat Coach/ }));
    fireEvent.click(confirm());
  };

  it("names the relationship that refused the pairing, and refreshes the list", async () => {
    createNested.mockRejectedValue(alreadyRelated({ relationship_id: "rel-9" }));
    listRelationships.mockResolvedValue([patCoachesCara("rel-9")]);
    const { onClose, onRelationshipsChanged } = renderDialog();
    pairCaraWithPatAsColleagues();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Pat Coach is already Cara Test's coach"));
    expect(listRelationships).toHaveBeenCalledWith("org-1");
    expect(onRelationshipsChanged).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("names the pair when the refusing relationship can't be read", async () => {
    createNested.mockRejectedValue(alreadyRelated({}));
    renderDialog();
    pairCaraWithPatAsColleagues();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Cara Test and Pat Coach already have a relationship")
    );
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
