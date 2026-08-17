import { EntityApiError } from "@/types/entity-api-error";

/**
 * Structured 409 discriminators the backend returns for organization writes
 * (see board contract AdminOrganizationCRUD v2). Each helper returns the
 * backend's human message when the error matches, otherwise null — so callers
 * can do `toast.error(organizationArchivedMessage(error) ?? fallback)`.
 */
function orgErrorMessage(
  error: unknown,
  code: string,
  fallback: string
): string | null {
  if (EntityApiError.isEntityApiError(error) && error.data?.error === code) {
    return typeof error.data?.message === "string" ? error.data.message : fallback;
  }
  return null;
}

export const organizationNameTakenMessage = (error: unknown): string | null =>
  orgErrorMessage(
    error,
    "organization_name_taken",
    "An organization with that name already exists."
  );

export const organizationNotEmptyMessage = (error: unknown): string | null =>
  orgErrorMessage(
    error,
    "organization_not_empty",
    "This organization still has coaching data and can't be deleted."
  );

export const organizationArchivedMessage = (error: unknown): string | null =>
  orgErrorMessage(
    error,
    "organization_archived",
    "This organization is archived and can't accept new changes."
  );

/// Shown both by the lookup pre-check and by the server's 409, so the two
/// paths cannot drift apart.
export const USER_ALREADY_IN_ORGANIZATION_MESSAGE =
  "This user is already a member of this organization.";

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
    "This user is the only admin of this organization. Assign another admin before removing them."
  );

export const userBelongsToMultipleOrganizationsMessage = (
  error: unknown
): string | null =>
  orgErrorMessage(
    error,
    "user_belongs_to_multiple_organizations",
    "This user belongs to other organizations. Remove them from this organization instead of deleting their account."
  );

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
