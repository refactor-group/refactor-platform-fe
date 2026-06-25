"use client";

import { DateTime } from "ts-luxon";
import { useUser } from "@/lib/api/users";
import { Organization } from "@/types/organization";

interface OrganizationArchivedBylineProps {
  organization: Organization;
}

/**
 * "Archived {date} by {name}" byline for an archived org. Resolves archived_by
 * (a user id) to a display name via GET /users/{id}; renders only when the org
 * is archived, so active rows never trigger the lookup. A missing archived_by on
 * an archived org means the archiver was since deleted (FK ON DELETE SET NULL).
 */
export function OrganizationArchivedByline({
  organization,
}: OrganizationArchivedBylineProps) {
  const { user } = useUser(organization.archived_by ?? "");

  const when = organization.archived_at
    ? DateTime.fromISO(organization.archived_at)
    : null;

  const resolvedName =
    user.display_name.trim() || `${user.first_name} ${user.last_name}`.trim();

  const archiver = !organization.archived_by
    ? "a former admin"
    : resolvedName || "…";

  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      Archived
      {when?.isValid ? ` ${when.toLocaleString(DateTime.DATE_MED)}` : ""} by{" "}
      {archiver}
    </p>
  );
}
