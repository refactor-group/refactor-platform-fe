/**
 * Session Display Types
 * Story: "Type-safe session display information"
 */

export enum SessionUrgency {
  Past = "past",
  Imminent = "imminent",
  Soon = "soon",
  Later = "later",
}

export interface SessionUrgencyInfo {
  type: SessionUrgency;
  message: string;
}

export interface EnrichedSessionDisplay {
  id: string;
  goalTitle: string;
  participantName: string;
  userRole: "Coach" | "Coachee";
  dateTime: string;
  organizationName: string;
  isPast: boolean;
  urgency: SessionUrgencyInfo;
}
