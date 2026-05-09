export type Status = "applied" | "oa" | "interview" | "offer" | "rejected";
export type EventType = "applied" | "oa" | "interview" | "offer" | "rejected" | "note";
export type ApplicationSeason = "Summer" | "Fall";

export const APPLICATION_SEASONS: readonly ApplicationSeason[] = ["Summer", "Fall"];

export interface ApplicationEvent {
  id: string;
  application_id: string;
  event_type: EventType;
  event_date: string;
  notes: string | null;
  round_number: number | null;
  deadline_date: string | null;
  deadline_completed_at: string | null;
  created_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  company: string;
  role: string;
  posting_url: string | null;
  location: string | null;
  season: ApplicationSeason | null;
  status: Status;
  archived_at: string | null;
  created_at: string;
  events: ApplicationEvent[];
  last_activity_date: string;
}
