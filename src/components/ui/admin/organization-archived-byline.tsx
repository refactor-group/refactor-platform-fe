"use client";

import { DateTime } from "ts-luxon";
import { useUser } from "@/lib/api/users";
import { Organization } from "@/types/organization";

interface OrganizationArchivedBylineProps {
  organization: Organization;
}

/**
 * "Archived {date} by {name}" byline for an archived org. Resolves archived_by
 * (a user id) to a display name via GET /users/{id} — the only lookup available,
 * since archivers are platform SuperAdmins not scoped to any one org's user list.
 * Renders only when the org is archived, so active rows never trigger the lookup.
 * Shows "…" only while the lookup is in flight; degrades to "a former admin" when
 * archived_by is absent (FK ON DELETE SET NULL) or the lookup fails/returns no name.
 */
export function OrganizationArchivedByline({
  organization,
}: OrganizationArchivedBylineProps) {
  const hasArchiver = Boolean(organization.archived_by);
  const { user, isLoading, isError } = useUser(organization.archived_by ?? "");

  const when = organization.archived_at
    ? DateTime.fromISO(organization.archived_at)
    : null;

  const resolvedName =
    user.display_name.trim() || `${user.first_name} ${user.last_name}`.trim();

  const archiverLabel =
    !hasArchiver || isError
      ? "a former admin"
      : resolvedName || (isLoading ? "…" : "a former admin");

  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      Archived
      {when?.isValid ? ` ${when.toLocaleString(DateTime.DATE_MED)}` : ""} by{" "}
      {archiverLabel}
    </p>
  );
}
