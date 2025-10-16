import { Id } from "@/types/general";

/**
 * Represents a user role assignment within an organization or at the system level.
 */
export interface UserRole {
  id: Id;
  user_id: Id;
  role: Role;
  organization_id: Id | null;
  created_at: string;
  updated_at: string;
}

/**
 * Discriminated union representing the state of a user's role for the current organization.
 * Use this type to handle role checks with proper error handling.
 */
export type UserRoleState =
  | { status: 'success'; role: Role; hasAccess: true }
  | { status: 'no_roles'; role: null; hasAccess: false; reason: 'USER_HAS_NO_ROLES' }
  | { status: 'no_access'; role: null; hasAccess: false; reason: 'NO_ORG_ACCESS'; organizationId: string }
  | { status: 'no_org_selected'; role: null; hasAccess: false; reason: 'NO_ORG_SELECTED' };

// This must always reflect the Rust struct on the backend entity::users::Model
export interface User {
  id: Id;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  display_name: string;
  timezone: string;
  /**
   * @deprecated Use roles array with getUserRoleForOrganization() instead
   */
  role: Role;
  roles: UserRole[];
}

export interface NewUser {
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  password: string;
  timezone: string;
}

export interface NewUserPassword {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export enum Role {
  User = "User",
  Admin = "Admin",
  SuperAdmin = "SuperAdmin"
}

export function parseUser(data: unknown): User {
  if (!isUser(data)) {
    throw new Error("Invalid User object data");
  }
  return {
    id: data.id,
    email: data.email,
    password: data.password,
    first_name: data.first_name,
    last_name: data.last_name,
    display_name: data.display_name,
    timezone: data.timezone || "UTC",
    role: data.role,
    roles: data.roles
  };
}

export function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    (typeof object.id === "string" &&
      typeof object.email === "string" &&
      typeof object.first_name === "string" &&
      typeof object.last_name === "string" &&
      typeof object.display_name === "string") ||
    typeof object.password === "string" // password is optional
  );
}

export function defaultUser(): User {
  return {
    id: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    display_name: "",
    timezone: "UTC",
    role: Role.User,
    roles: [],
  };
}

// Given first and last name strings, return the first letters of each as a new string
// e.g. "John" "Smith" => "JS"
export function userFirstLastLettersToString(
  firstName: string,
  lastName: string
): string {
  const firstLetter = firstName.charAt(0);
  const lastLetter = lastName.charAt(0);
  return firstLetter + lastLetter;
}

export function userToString(user: User | undefined): string {
  return JSON.stringify(user);
}

/**
 * Determines the appropriate role for a user within a given organization context.
 *
 * @param roles - Array of UserRole assignments for the user
 * @param organizationId - The current organization ID, or null for system-level context
 * @returns The Role for the user in the given organization context, or null if no matching role
 */
export function getUserRoleForOrganization(
  roles: UserRole[],
  organizationId: Id | null
): Role | null {
  // SuperAdmin users have global access (organization_id is null)
  const superAdminRole = roles.find(
    (r) => r.role === Role.SuperAdmin && r.organization_id === null
  );
  if (superAdminRole) {
    return Role.SuperAdmin;
  }

  // Find role matching the current organization
  const orgRole = roles.find((r) => r.organization_id === organizationId);
  return orgRole?.role ?? null;
}

/**
 * Checks if the user has administrative privileges (Admin or SuperAdmin).
 * Note: Admin has org-scoped privileges, SuperAdmin has global privileges.
 *
 * @param roleState - The user's role state from useCurrentUserRole
 * @returns true if user is Admin or SuperAdmin
 */
export function isAdminOrSuperAdmin(roleState: UserRoleState): boolean {
  return roleState.hasAccess && (roleState.role === Role.Admin || roleState.role === Role.SuperAdmin);
}
