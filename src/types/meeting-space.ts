export interface MeetingSpace {
  meeting_id: string;
  join_url: string;
  host_url: string;
  dial_in?: string;
  platform_metadata?: Record<string, unknown>;
}
