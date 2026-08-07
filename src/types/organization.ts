import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";

// This must always reflect the Rust struct on the backend
// entity::organizations::Model
export interface Organization {
  id: Id;
  name: string;
  logo?: string;
  slug: string;
  // absent/null = active, timestamp = archived (server-managed via archive/unarchive)
  archived_at?: string;
  // user id of the SuperAdmin who archived; absent while active, and may be
  // absent even while archived if that user was later deleted (FK ON DELETE SET
  // NULL). Resolve to a name via GET /users/{id}. Not authoritative for archive
  // state — use archived_at.
  archived_by?: string;
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
    created_at: now,
    updated_at: now,
  };
}

export function defaultOrganizations(): Organization[] {
  return [defaultOrganization()];
}

/** Up-to-two-letter avatar initials: "Refactor Group" -> "RG", "BigTable" -> "BT", "" -> "?". */
export function organizationInitials(name: string | undefined): string {
  const words = (name ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";

  if (words.length > 1) {
    return words
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("")
      .toUpperCase();
  }

  // A single word may be camel or Pascal case, where a capital starts a new
  // part ("BigTable" -> "BT"). One part means no internal boundary, so fall
  // back to the word's first two letters ("Acme" -> "AC").
  const parts = words[0].match(/\p{Lu}+\p{Ll}*|\p{Ll}+/gu) ?? [];
  const letters =
    parts.length > 1
      ? parts.map((part) => Array.from(part)[0])
      : Array.from(words[0]);

  return letters.slice(0, 2).join("").toUpperCase();
}

export function organizationToString(organization: Organization): string {
  return JSON.stringify(organization);
}

export function organizationsToString(organizations: Organization[]): string {
  return JSON.stringify(organizations);
}
