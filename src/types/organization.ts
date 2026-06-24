import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";

// This must always reflect the Rust struct on the backend
// entity::organizations::Model
export interface Organization {
  id: Id;
  name: string;
  logo?: string;
  slug: string;
  // null = active, non-null timestamp = archived (server-managed via archive/unarchive)
  archived_at: string | null;
  created_at: DateTime;
  updated_at: DateTime;
}

/** Filter for the admin org list, mapped to the backend `?status=` query param. */
export enum OrganizationStatusFilter {
  Active = "active",
  Archived = "archived",
  All = "all",
}

export function isOrganizationArchived(organization: Organization): boolean {
  // Loose != null treats both null and a not-yet-present field (before the
  // backend ships archived_at) as active; only a real timestamp is archived.
  return organization.archived_at != null;
}

export function isOrganization(value: unknown): value is Organization {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    (typeof object.id === "string" &&
      typeof object.name === "string" &&
      typeof object.slug === "string" &&
      typeof object.created_at === "string" &&
      typeof object.updated_at === "string") ||
    typeof object.logo === "string" // logo is optional
  );
}

export function isOrganizationsArray(value: unknown): value is Organization[] {
  return Array.isArray(value) && value.every(isOrganization);
}

export function getOrganizationById(
  id: string,
  organizations: Organization[]
): Organization {
  const organization = organizations.find(
    (organization) => organization.id === id
  );
  return organization ? organization : defaultOrganization();
}

export function defaultOrganization(): Organization {
  var now = DateTime.now();
  return {
    id: "",
    name: "",
    logo: "",
    slug: "",
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
}

export function defaultOrganizations(): Organization[] {
  return [defaultOrganization()];
}

export function organizationToString(organization: Organization): string {
  return JSON.stringify(organization);
}

export function organizationsToString(organizations: Organization[]): string {
  return JSON.stringify(organizations);
}
