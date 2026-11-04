import type { OrganizationMembership } from "@/lib/hooks/use-reconcile-current-organization";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";

export interface OrganizationToSwitchToOptions {
  sessionOrganizationId: Option<Id>;
  currentOrganizationId: Id;
  membership: OrganizationMembership;
}

/** The session's organization, when the user belongs to it and it isn't already selected. */
export function organizationToSwitchTo({
  sessionOrganizationId,
  currentOrganizationId,
  membership,
}: OrganizationToSwitchToOptions): Option<Id> {
  if (sessionOrganizationId.none || membership.kind !== "loaded") return None;
  const id = sessionOrganizationId.val;
  if (id === currentOrganizationId) return None;
  const isMember = membership.organizations.some((organization) => organization.id === id);
  return isMember ? Some(id) : None;
}
