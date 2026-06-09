"use server";

import type { UIMessage } from "ai";
import { revalidatePath } from "next/cache";
import {
  ChatThreadNotFoundError,
  assertThreadOwnership,
  isUuid,
} from "@/lib/chat/assert-thread-ownership";
import { generateThreadTitleFromMessage } from "@/lib/chat/thread-title";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { limitServerActionByIp } from "@/lib/rate-limit";
import type { ChatThreadRow } from "@/lib/chat/types";

const WRITE_LIMIT = 30;
const WRITE_WINDOW_MS = 60_000;

async function limitChatWrite() {
  return limitServerActionByIp("chat-write", WRITE_LIMIT, WRITE_WINDOW_MS);
}

function mapThread(row: {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}): ChatThreadRow {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanThreadTitle(title: unknown): string {
  return typeof title === "string" ? title.trim().slice(0, 120) || "New chat" : "New chat";
}

export async function listChatThreads(): Promise<
  { threads: ChatThreadRow[] } | { error: string }
> {
  const rateLimit = await limitChatWrite();
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Rate limited" };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("chat_threads")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return { error: "Unable to load chat threads." };
  return { threads: (data ?? []).map(mapThread) };
}

export async function createChatThread(
  title?: string,
): Promise<{ thread: ChatThreadRow } | { error: string }> {
  const rateLimit = await limitChatWrite();
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Rate limited" };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("chat_threads")
    .insert({
      user_id: user.id,
      title: cleanThreadTitle(title),
    })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) return { error: "Unable to create chat." };
  revalidatePath("/chat");
  return { thread: mapThread(data) };
}

export async function loadChatThreadMessages(
  threadId: string,
): Promise<{ messages: UIMessage[] } | { error: string }> {
  const rateLimit = await limitChatWrite();
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Rate limited" };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await assertThreadOwnership(supabase, threadId, user.id);
  } catch (error) {
    if (error instanceof ChatThreadNotFoundError) return { error: "Thread not found" };
    throw error;
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) return { error: "Unable to load messages." };

  const messages: UIMessage[] = (data ?? []).map((row) => ({
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: Array.isArray(row.parts) ? row.parts : [],
  }));

  return { messages };
}

export async function deleteChatThread(
  threadId: string,
): Promise<{ ok: true } | { error: string }> {
  const rateLimit = await limitChatWrite();
  if (!rateLimit.ok) return { error: rateLimit.error ?? "Rate limited" };

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await assertThreadOwnership(supabase, threadId, user.id);
  } catch (error) {
    if (error instanceof ChatThreadNotFoundError) return { error: "Thread not found" };
    throw error;
  }

  const { error } = await supabase
    .from("chat_threads")
    .delete()
    .eq("id", threadId)
    .eq("user_id", user.id);
  if (error) return { error: "Unable to delete chat." };

  revalidatePath("/chat");
  return { ok: true };
}

export async function getChatThreadTitle(
  threadId: string,
): Promise<{ title: string } | { error: string }> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };
  if (!isUuid(threadId)) return { error: "Thread not found" };

  const { data, error } = await supabase
    .from("chat_threads")
    .select("title")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { error: "Unable to load chat title." };
  if (!data) return { error: "Thread not found" };
  return { title: data.title };
}

export async function renameChatThreadFromFirstMessage(
  threadId: string,
  messageText: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return;
  if (!isUuid(threadId) || typeof messageText !== "string") return;

  const title = await generateThreadTitleFromMessage(messageText);
  await supabase
    .from("chat_threads")
    .update({ title })
    .eq("id", threadId)
    .eq("user_id", user.id)
    .eq("title", "New chat");
}
