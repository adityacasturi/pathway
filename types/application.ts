export type Status = "applied" | "oa" | "interview" | "offer" | "rejected";
export type EventType = "applied" | "oa" | "interview" | "offer" | "rejected" | "note";
export type ApplicationSeason = "Summer" | "Fall" | "Spring" | "Winter";

export const APPLICATION_SEASONS: readonly ApplicationSeason[] = [
  "Summer",
  "Fall",
  "Spring",
  "Winter",
];

export interface ApplicationEvent {
  id: string;
  application_id: string;
  event_type: EventType;
  event_date: string;
  notes: string | null;
  round_number: number | null;
  created_at: string;
  /** Stable React key for optimistic add → server reconcile without remounting. */
  clientKey?: string;
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
