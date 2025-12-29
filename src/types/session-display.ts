/**
 * Session Display Types
 * Story: "Type-safe session display information"
 */

import type { RelationshipRole } from "./relationship-role";

export enum SessionUrgency {
  Past = "past",
  Imminent = "imminent",
  Soon = "soon",
  Later = "later",
}

export interface SessionUrgencyInfo {
  readonly type: SessionUrgency;
  readonly message: string;
}

export interface EnrichedSessionDisplay {
  readonly id: string;
  readonly goalTitle: string;
  readonly participantName: string;
  readonly userRole: RelationshipRole;
  readonly dateTime: string;
  readonly organizationName: string;
  readonly isPast: boolean;
  readonly urgency: SessionUrgencyInfo;
}
