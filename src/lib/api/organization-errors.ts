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
