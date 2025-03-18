import { Id } from "@/types/general";

// This must always reflect the Rust struct on the backend controller::user_session
export interface UserSession {
  id: Id;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  display_name: string;
}

export function parseUserSession(data: unknown): UserSession {
  if (!isUserSession(data)) {
    throw new Error("Invalid UserSession object data");
  }
  return {
    id: data.id,
    email: data.email,
    password: data.password,
    first_name: data.first_name,
    last_name: data.last_name,
    display_name: data.display_name,
  };
}

export function isUserSession(value: unknown): value is UserSession {
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

export function defaultUserSession(): UserSession {
  return {
    id: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    display_name: "",
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

export function userSessionToString(
  userSession: UserSession | undefined
): string {
  return JSON.stringify(userSession);
}
