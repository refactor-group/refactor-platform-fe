import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DateTime } from "ts-luxon";
import {
  useReconcileCurrentOrganization,
  type OrganizationMembership,
} from "@/lib/hooks/use-reconcile-current-organization";
import type { Id } from "@/types/general";
import type { Organization } from "@/types/organization";
import { None, Some, type Option } from "@/types/option";

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
  currentOrganizationId: string,
  rememberedOrganizationId: Option<Id> = None
) {
  const setCurrentOrganizationId = vi.fn();
  const forgetRememberedOrganization = vi.fn();
  const rendered = renderHook(
    ({ membership, currentOrganizationId, rememberedOrganizationId }) =>
      useReconcileCurrentOrganization({
        membership,
        currentOrganizationId,
        setCurrentOrganizationId,
        rememberedOrganizationId,
        forgetRememberedOrganization,
      }),
    {
      initialProps: {
        membership,
        currentOrganizationId,
        rememberedOrganizationId,
      },
    }
  );
  return { ...rendered, setCurrentOrganizationId, forgetRememberedOrganization };
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
    const membership = loaded([BETA]);
    const { rerender, setCurrentOrganizationId } = renderReconciler(
      membership,
      ACME.id
    );
    expect(setCurrentOrganizationId).toHaveBeenCalledTimes(1);

    // Same snapshot object throughout — no new evidence has arrived.
    rerender({
      membership,
      currentOrganizationId: BETA.id,
      rememberedOrganizationId: None,
    });
    rerender({
      membership,
      currentOrganizationId: ACME.id,
      rememberedOrganizationId: None,
    });

    expect(setCurrentOrganizationId).toHaveBeenCalledTimes(1);
  });

  // Without this, a route that writes a revoked id back into global state
  // (the members page syncs it from the URL) pins that id until the component
  // unmounts, and every organization-scoped read keeps aiming at it.
  it("reconsiders a written-back id once a fresh membership snapshot arrives", () => {
    const { rerender, setCurrentOrganizationId } = renderReconciler(
      loaded([BETA]),
      ACME.id
    );
    expect(setCurrentOrganizationId).toHaveBeenCalledTimes(1);

    rerender({
      membership: loaded([BETA]),
      currentOrganizationId: ACME.id,
      rememberedOrganizationId: None,
    });

    expect(setCurrentOrganizationId).toHaveBeenCalledTimes(2);
    expect(setCurrentOrganizationId).toHaveBeenLastCalledWith(BETA.id);
  });

  describe("with a remembered organization", () => {
    it("selects the remembered organization when none is set", () => {
      const { setCurrentOrganizationId } = renderReconciler(
        loaded([ACME, BETA]),
        "",
        Some(BETA.id)
      );

      expect(setCurrentOrganizationId).toHaveBeenCalledWith(BETA.id);
      expect(setCurrentOrganizationId).toHaveBeenCalledTimes(1);
    });

    it("falls back to the first organization when the remembered one is gone", () => {
      const { setCurrentOrganizationId } = renderReconciler(
        loaded([ACME]),
        "",
        Some(BETA.id)
      );

      expect(setCurrentOrganizationId).toHaveBeenCalledWith(ACME.id);
    });

    it("replaces a revoked selection with the remembered organization", () => {
      const { setCurrentOrganizationId } = renderReconciler(
        loaded([ACME, BETA]),
        "org-gone",
        Some(BETA.id)
      );

      expect(setCurrentOrganizationId).toHaveBeenCalledWith(BETA.id);
    });

    it("leaves a still-valid selection alone", () => {
      const { setCurrentOrganizationId } = renderReconciler(
        loaded([ACME, BETA]),
        ACME.id,
        Some(BETA.id)
      );

      expect(setCurrentOrganizationId).not.toHaveBeenCalled();
    });

    it("stays inert while membership is unknown", () => {
      const { setCurrentOrganizationId } = renderReconciler(
        { kind: "unknown" },
        "",
        Some(BETA.id)
      );

      expect(setCurrentOrganizationId).not.toHaveBeenCalled();
    });

    it("forgets a remembered organization the user no longer belongs to", () => {
      const { forgetRememberedOrganization } = renderReconciler(
        loaded([ACME]),
        "",
        Some(BETA.id)
      );

      expect(forgetRememberedOrganization).toHaveBeenCalledTimes(1);
    });

    it("keeps a remembered organization the user still belongs to", () => {
      const { forgetRememberedOrganization } = renderReconciler(
        loaded([ACME, BETA]),
        ACME.id,
        Some(BETA.id)
      );

      expect(forgetRememberedOrganization).not.toHaveBeenCalled();
    });

    // An unloaded list can't tell a revoked organization from an unfetched one.
    it("forgets nothing while membership is unknown", () => {
      const { forgetRememberedOrganization } = renderReconciler(
        { kind: "unknown" },
        "",
        Some(BETA.id)
      );

      expect(forgetRememberedOrganization).not.toHaveBeenCalled();
    });

    it("has nothing to forget without a remembered organization", () => {
      const { forgetRememberedOrganization } = renderReconciler(
        loaded([ACME]),
        ""
      );

      expect(forgetRememberedOrganization).not.toHaveBeenCalled();
    });
  });
});
