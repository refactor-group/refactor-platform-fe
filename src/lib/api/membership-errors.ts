import type { Option } from "@/types/option";

/** What adding the person back would let the viewer do; it ends the toast. */
export enum AddBackPurpose {
  ScheduleSessions = "schedule_sessions",
  ResendInvite = "resend_invite",
  AssignActions = "assign_actions",
}

function purposeText(purpose: AddBackPurpose): string {
  switch (purpose) {
    case AddBackPurpose.ScheduleSessions:
      return "to schedule sessions";
    case AddBackPurpose.ResendInvite:
      return "to resend the invite";
    case AddBackPurpose.AssignActions:
      return "to assign actions";
    default: {
      const _exhaustive: never = purpose;
      throw new Error(`Unhandled add-back purpose: ${_exhaustive}`);
    }
  }
}

export const notAMemberText = (name: string): string => `${name} is no longer in this organization`;

/** Two-part toast copy: who is no longer a member, then what the viewer can do about it. */
export function notAMemberMessage(
  purpose: AddBackPurpose,
  name: Option<string>,
  canAddBack: boolean
): string {
  const them = name.some ? name.val : "this person";
  const next = canAddBack ? `Add ${them} back ${purposeText(purpose)}` : `Ask an admin to add ${them} back`;
  return `${notAMemberText(name.some ? name.val : "This person")} · ${next}`;
}
