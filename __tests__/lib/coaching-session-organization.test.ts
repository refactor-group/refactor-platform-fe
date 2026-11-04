import { describe, expect, it } from "vitest";
import { organizationToSwitchTo } from "@/lib/coaching-session-organization";
import type { OrganizationMembership } from "@/lib/hooks/use-reconcile-current-organization";
import { serializeCoachingSession, transformCoachingSession } from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { createMockOrganization } from "../test-utils";

const ACME = createMockOrganization({ id: "org-acme", name: "Acme Corp" });
const BIGTABLE = createMockOrganization({ id: "org-bigtable", name: "BigTable" });
const loaded = (organizations = [ACME, BIGTABLE]): OrganizationMembership => ({ kind: "loaded", organizations });

describe("organizationToSwitchTo", () => {
  it("switches to the session's organization when it differs and the user is a member", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-bigtable"),
        currentOrganizationId: "org-acme",
        membership: loaded(),
      })
    ).toEqual(Some("org-bigtable"));
  });

  it("stays put when the session is already in the selected organization", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-acme"),
        currentOrganizationId: "org-acme",
        membership: loaded(),
      })
    ).toEqual(None);
  });

  it("stays put when the user isn't a member there (a global super admin)", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-bigtable"),
        currentOrganizationId: "org-acme",
        membership: loaded([ACME]),
      })
    ).toEqual(None);
  });

  it("waits until memberships have loaded", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-bigtable"),
        currentOrganizationId: "org-acme",
        membership: { kind: "unknown" },
      })
    ).toEqual(None);
  });

  it("does nothing without the session's organization", () => {
    expect(
      organizationToSwitchTo({ sessionOrganizationId: None, currentOrganizationId: "org-acme", membership: loaded() })
    ).toEqual(None);
  });

  it("selects the session's organization when none is selected yet", () => {
    expect(
      organizationToSwitchTo({
        sessionOrganizationId: Some("org-bigtable"),
        currentOrganizationId: "",
        membership: loaded(),
      })
    ).toEqual(Some("org-bigtable"));
  });
});

describe("organization_id on the wire", () => {
  const raw = (organizationId?: string) => ({
    id: "s-1",
    coaching_relationship_id: "rel-1",
    date: "2026-11-10T14:30:00",
    duration_minutes: 50,
    title: null,
    coaching_session_series_id: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...(organizationId === undefined ? {} : { organization_id: organizationId }),
  });

  it("reads it as Some on the single-session read and None where it's absent", () => {
    expect(transformCoachingSession(raw("org-bigtable")).organization_id).toEqual(Some("org-bigtable"));
    expect(transformCoachingSession(raw()).organization_id).toEqual(None);
  });

  it("never sends it back on a write", () => {
    expect(serializeCoachingSession(transformCoachingSession(raw("org-bigtable")))).not.toHaveProperty(
      "organization_id"
    );
  });
});
