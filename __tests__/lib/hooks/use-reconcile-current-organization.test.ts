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

const USER_ID = "user-1";

function renderReconciler(
  membership: OrganizationMembership,
  currentOrganizationId: string,
  remembered: Option<Id> = None
) {
  const setCurrentOrganizationId = vi.fn();
  const forgetOrganizationForUser = vi.fn();
  const lastOrganizationIdByUser: Record<Id, Id> = remembered.some
    ? { [USER_ID]: remembered.val }
    : {};
  const rendered = renderHook(
    ({ membership, currentOrganizationId }) =>
      useReconcileCurrentOrganization({
        membership,
        currentOrganizationId,
        setCurrentOrganizationId,
        userId: USER_ID,
        lastOrganizationIdByUser,
        forgetOrganizationForUser,
      }),
    { initialProps: { membership, currentOrganizationId } }
  );
  return { ...rendered, setCurrentOrganizationId, forgetOrganizationForUser };
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
    rerender({ membership, currentOrganizationId: BETA.id });
    rerender({ membership, currentOrganizationId: ACME.id });

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

    rerender({ membership: loaded([BETA]), currentOrganizationId: ACME.id });

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
      const { forgetOrganizationForUser } = renderReconciler(
        loaded([ACME]),
        "",
        Some(BETA.id)
      );

      expect(forgetOrganizationForUser).toHaveBeenCalledTimes(1);
      expect(forgetOrganizationForUser).toHaveBeenCalledWith(USER_ID);
    });

    it("keeps a remembered organization the user still belongs to", () => {
      const { forgetOrganizationForUser } = renderReconciler(
        loaded([ACME, BETA]),
        ACME.id,
        Some(BETA.id)
      );

      expect(forgetOrganizationForUser).not.toHaveBeenCalled();
    });

    // An unloaded list can't tell a revoked organization from an unfetched one.
    it("forgets nothing while membership is unknown", () => {
      const { forgetOrganizationForUser } = renderReconciler(
        { kind: "unknown" },
        "",
        Some(BETA.id)
      );

      expect(forgetOrganizationForUser).not.toHaveBeenCalled();
    });

    it("has nothing to forget without a remembered organization", () => {
      const { forgetOrganizationForUser } = renderReconciler(
        loaded([ACME]),
        ""
      );

      expect(forgetOrganizationForUser).not.toHaveBeenCalled();
    });
  });
});
