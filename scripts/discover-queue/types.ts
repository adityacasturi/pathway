export type QueueStatus = "pending" | "claimed" | "done" | "failed" | "skipped";

export type SourceHint = "greenhouse" | "ashby" | "lever" | "workday" | "workable" | "unknown";

export interface QueueItemInput {
  slug: string;
  name: string;
  websiteUrl?: string | null;
  careersUrl?: string | null;
  industry?: string | null;
  hints?: SourceHint[];
  notes?: string | null;
  priority?: number;
}

export interface QueueItem extends QueueItemInput {
  id: number;
  status: QueueStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  heartbeatAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimResult {
  claimed: QueueItem | null;
  workerId: string;
}
