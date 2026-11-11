import { EntityApiError } from "@/types/entity-api-error";

/**
 * Structured 409 discriminators the backend returns for organization writes
 * (see board contract AdminOrganizationCRUD v2). Each helper returns our copy
 * when the error matches, otherwise null — so callers can do
 * `toast.error(organizationArchivedMessage(error) ?? fallback)`.
 */
function orgErrorMessage(
  error: unknown,
  code: string,
  message: string
): string | null {
  return EntityApiError.isEntityApiError(error) && error.data?.error === code
    ? message
    : null;
}

/** Feeds the inline name field, so it keeps the backend's message when present. */
export const organizationNameTakenMessage = (error: unknown): string | null => {
  if (
    EntityApiError.isEntityApiError(error) &&
    error.data?.error === "organization_name_taken"
  ) {
    return typeof error.data?.message === "string"
      ? error.data.message
      : "An organization with that name already exists.";
  }
  return null;
};

export const organizationNotEmptyMessage = (error: unknown): string | null =>
  orgErrorMessage(
    error,
    "organization_not_empty",
    "This organization still has coaching data · It can't be deleted"
  );

export const organizationArchivedMessage = (error: unknown): string | null =>
  orgErrorMessage(
    error,
    "organization_archived",
    "This organization is archived · It can't be changed"
  );

/// Shown both by the lookup pre-check and by the server's 409, so the two
/// paths cannot drift apart.
export const USER_ALREADY_IN_ORGANIZATION_MESSAGE =
  "They're already a member of this organization";

export const userAlreadyInOrganizationMessage = (
  error: unknown
): string | null =>
  orgErrorMessage(
    error,
    "user_already_in_organization",
    USER_ALREADY_IN_ORGANIZATION_MESSAGE
  );

export const lastOrganizationAdminMessage = (error: unknown): string | null =>
  orgErrorMessage(
    error,
    "last_organization_admin",
    "They're this organization's only admin · Make someone else an admin first"
  );

export const userBelongsToMultipleOrganizationsMessage = (
  error: unknown
): string | null =>
  orgErrorMessage(
    error,
    "user_belongs_to_multiple_organizations",
    "They belong to other organizations · Remove them from this one instead"
  );

/** A member with coaching sessions can't be deleted, only removed from the organization. */
export const userHasCoachingHistory = (error: unknown): boolean =>
  EntityApiError.isEntityApiError(error) &&
  error.status === 409 &&
  error.data?.details?.reason === "user_has_coaching_history";

/** Longest organization name the backend accepts (characters, trimmed). */
export const ORGANIZATION_NAME_MAX_LENGTH = 255;

/**
 * A `422 validation_error` from an organization create/rename — an empty/
 * whitespace or over-{@link ORGANIZATION_NAME_MAX_LENGTH}-char name. Returns the
 * backend's message, else null. `validation_error` is a SHARED discriminator, so
 * only call this from the org create/edit form (never treat it as a global org
 * error). Distinct from the `organization_name_taken` 409 (a uniqueness collision).
 */
export const organizationNameInvalidMessage = (error: unknown): string | null => {
  if (
    EntityApiError.isEntityApiError(error) &&
    error.status === 422 &&
    error.data?.error === "validation_error"
  ) {
    return typeof error.data?.message === "string"
      ? error.data.message
      : "Please enter a valid organization name.";
  }
  return null;
};

/**
 * A `422 validation_error` from a membership role change — the backend rejects
 * granting SuperAdmin within an organization. Returns our copy, else null. `validation_error` is a SHARED discriminator, so only call this
 * from the role-change flow (never treat it as a global org error).
 */
export const roleChangeInvalidMessage = (error: unknown): string | null => {
  if (
    EntityApiError.isEntityApiError(error) &&
    error.status === 422 &&
    error.data?.error === "validation_error"
  ) {
    return "That role can't be assigned in this organization";
  }
  return null;
};

/**
 * Client-side mirror of the backend name rule, so the dialog can flag a bad name
 * before the round-trip. Returns an inline message, or null when the name is ok.
 */
export const validateOrganizationName = (name: string): string | null => {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Organization name must not be empty.";
  if (trimmed.length > ORGANIZATION_NAME_MAX_LENGTH) {
    return `Organization name must be at most ${ORGANIZATION_NAME_MAX_LENGTH} characters (got ${trimmed.length}).`;
  }
  return null;
};
