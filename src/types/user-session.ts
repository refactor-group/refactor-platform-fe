import { User, Role } from "@/types/user";

/**
 * This is an intersection type that combines the User type with additional properties.
 * Currently, it does not add any new properties, but it can be extended in the future
 * to decorate the User type if the two types need to diverge in the future.
 */
export type UserSession = User;

const isUserSession = (value: unknown): value is UserSession => {
  return (
    value !== null &&
    typeof value === "object" &&
    "id" in value &&
    "email" in value &&
    "first_name" in value &&
    "last_name" in value &&
    "display_name" in value
  );
};

export function defaultUserSession(): UserSession {
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

export function userSessionToString(
  user_session: UserSession | undefined
): string {
  return JSON.stringify(user_session);
}

// Given first and last name strings, return the first letters of each as a new string
// e.g. "John" "Smith" => "JS"
export function userSessionFirstLastLettersToString(
  firstName: string,
  lastName: string
): string {
  const firstLetter = firstName.charAt(0);
  const lastLetter = lastName.charAt(0);
  return firstLetter + lastLetter;
}
