/** Payload sent to POST /magic-link/complete-setup */
export interface MagicLinkSetupRequest {
  token: string;
  password: string;
  confirm_password: string;
}

/**
 * Discriminated union for the setup page state machine.
 * Covers: initial token validation, form ready, submission, success, and error.
 */
export type SetupPageState =
  | { kind: "validating" }
  | { kind: "ready"; email: string }
  | { kind: "submitting"; email: string }
  | { kind: "success"; email: string }
  | { kind: "error"; message: string };
