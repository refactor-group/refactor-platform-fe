import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DateTime } from "ts-luxon";
import {
  useReconcileCurrentOrganization,
  type OrganizationMembership,
} from "@/lib/hooks/use-reconcile-current-organization";
import type { Organization } from "@/types/organization";

function organization(id: string, name: string): Organization {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
  };
}

const ACME = organization("org-1", "Acme Corp");
const BETA = organization("org-2", "Beta Inc");

function renderReconciler(
  membership: OrganizationMembership,
  currentOrganizationId: string
) {
  const setCurrentOrganizationId = vi.fn();
  const rendered = renderHook(
    ({ membership, currentOrganizationId }) =>
      useReconcileCurrentOrganization(
        membership,
        currentOrganizationId,
        setCurrentOrganizationId
      ),
    { initialProps: { membership, currentOrganizationId } }
  );
  return { ...rendered, setCurrentOrganizationId };
}

const loaded = (organizations: Organization[]): OrganizationMembership => ({
  kind: "loaded",
  organizations,
});

describe("useReconcileCurrentOrganization", () => {
  it("clears a selection the user is no longer a member of", () => {
    const { setCurrentOrganizationId } = renderReconciler(
      loaded([BETA]),
      ACME.id
    );

    expect(setCurrentOrganizationId).toHaveBeenCalledWith(BETA.id);
  });

  it("clears to empty when no organizations remain", () => {
    const { setCurrentOrganizationId } = renderReconciler(loaded([]), ACME.id);

    expect(setCurrentOrganizationId).toHaveBeenCalledWith("");
  });

  it("leaves a still-valid selection alone", () => {
    const { setCurrentOrganizationId } = renderReconciler(
      loaded([ACME, BETA]),
      BETA.id
    );

    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("selects the first organization when none is set", () => {
    const { setCurrentOrganizationId } = renderReconciler(
      loaded([ACME, BETA]),
      ""
    );

    expect(setCurrentOrganizationId).toHaveBeenCalledWith(ACME.id);
  });

  it("stays inert while membership is unknown", () => {
    const { setCurrentOrganizationId } = renderReconciler(
      { kind: "unknown" },
      ACME.id
    );

    expect(setCurrentOrganizationId).not.toHaveBeenCalled();
  });

  it("does not fight code that re-selects a revoked organization", () => {
    const { rerender, setCurrentOrganizationId } = renderReconciler(
      loaded([BETA]),
      ACME.id
    );
    expect(setCurrentOrganizationId).toHaveBeenCalledTimes(1);

    rerender({ membership: loaded([BETA]), currentOrganizationId: BETA.id });
    rerender({ membership: loaded([BETA]), currentOrganizationId: ACME.id });

    expect(setCurrentOrganizationId).toHaveBeenCalledTimes(1);
  });
});
