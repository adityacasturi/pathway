import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export class ChatThreadNotFoundError extends Error {
  constructor() {
    super("Chat thread not found");
    this.name = "ChatThreadNotFoundError";
  }
}

export async function assertThreadOwnership(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
): Promise<void> {
  if (!isUuid(threadId)) {
    throw new ChatThreadNotFoundError();
  }

  const { data, error } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("id", threadId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new ChatThreadNotFoundError();
  }
}

export async function threadOwnedByUser(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
): Promise<boolean> {
  try {
    await assertThreadOwnership(supabase, threadId, userId);
    return true;
  } catch (error) {
    if (error instanceof ChatThreadNotFoundError) {
      return false;
    }
    throw error;
  }
}
