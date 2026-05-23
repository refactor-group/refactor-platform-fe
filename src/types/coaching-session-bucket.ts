import type { DateTime } from "ts-luxon";
import type { Option } from "@/types/option";

export enum CoachingSessionBucketKind {
  Future = "future",
  Past = "past",
}

export interface CoachingSessionBucketDescriptor {
  kind: CoachingSessionBucketKind;
  start: DateTime;
  end: DateTime;
  label: string;
  key: string;
  crossesYearFromPrevious: boolean;
}

export interface CoachingSessionCountByMonth {
  month: string;
  count: number;
}

export type CoachingSessionBucketCount = Option<number>;
