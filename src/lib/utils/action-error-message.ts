import { EntityApiError, PERMISSION_DENIED_MESSAGE } from "@/lib/api/entity-api";

/**
 * The toast for a failed action mutation. `verb` reads as the phrase in
 * "Couldn't <verb>" (e.g. "update the status").
 */
export function actionErrorMessage(verb: string, err: unknown): string {
  if (err instanceof EntityApiError) {
    if (err.isForbidden()) return PERMISSION_DENIED_MESSAGE;
    if (err.isNetworkError()) return `Couldn't ${verb} · Check your connection and try again`;
  }
  return `Couldn't ${verb}`;
}
