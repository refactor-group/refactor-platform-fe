import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";

/**
 * User integration settings for external services.
 * Contains connection status for Google, Recall.ai, and AssemblyAI.
 */
export interface UserIntegration {
  id: Id;
  user_id: Id;
  /** Whether Google OAuth is connected */
  google_connected: boolean;
  /** Connected Google email address */
  google_email: string | null;
  /** Whether Recall.ai API key is configured */
  recall_ai_configured: boolean;
  /** When Recall.ai was last verified */
  recall_ai_verified_at: string | null;
  /** Whether AssemblyAI API key is configured */
  assembly_ai_configured: boolean;
  /** When AssemblyAI was last verified */
  assembly_ai_verified_at: string | null;
  created_at: DateTime;
  updated_at: DateTime;
}

/**
 * Payload for updating Recall.ai integration.
 */
export interface RecallAiIntegrationUpdate {
  api_key: string;
  region?: string;
}

/**
 * Payload for updating AssemblyAI integration.
 */
export interface AssemblyAiIntegrationUpdate {
  api_key: string;
}

/**
 * Response from API key verification endpoint.
 */
export interface IntegrationVerifyResponse {
  success: boolean;
  message: string;
  verified_at?: string;
}

/**
 * Type guard for UserIntegration.
 */
export function isUserIntegration(value: unknown): value is UserIntegration {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.user_id === "string" &&
    typeof object.google_connected === "boolean" &&
    typeof object.recall_ai_configured === "boolean" &&
    typeof object.assembly_ai_configured === "boolean"
  );
}

/**
 * Returns a default empty UserIntegration.
 */
export function defaultUserIntegration(): UserIntegration {
  const now = DateTime.now();
  return {
    id: "",
    user_id: "",
    google_connected: false,
    google_email: null,
    recall_ai_configured: false,
    recall_ai_verified_at: null,
    assembly_ai_configured: false,
    assembly_ai_verified_at: null,
    created_at: now,
    updated_at: now,
  };
}
