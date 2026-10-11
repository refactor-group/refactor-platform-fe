import type { Action } from "@/types/action";

const PREVIEW_LENGTH = 40;

/** Truncate action body for display in toast messages. */
export function actionPreview(action: Action | undefined): string {
  if (!action?.body) return "Action";
  return action.body.length > PREVIEW_LENGTH
    ? `${action.body.slice(0, PREVIEW_LENGTH)}...`
    : action.body;
}
