import type { UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertThreadOwnership } from "./assert-thread-ownership.ts";

function mapStoredMessage(row: {
  id: string;
  role: string;
  parts: unknown;
}): UIMessage {
  return {
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: Array.isArray(row.parts) ? row.parts : [],
  };
}

export async function persistChatMessages(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  messages: UIMessage[],
): Promise<void> {
  await assertThreadOwnership(supabase, threadId, userId);

  const rows = messages.map((message) => ({
    thread_id: threadId,
    role: message.role,
    parts: message.parts,
    client_message_id: null,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("chat_messages").insert(rows);
  if (error) throw error;
}

export async function persistUserChatMessage(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  message: UIMessage,
): Promise<UIMessage> {
  await assertThreadOwnership(supabase, threadId, userId);

  const { data: existing, error: existingError } = await supabase
    .from("chat_messages")
    .select("id, role, parts")
    .eq("thread_id", threadId)
    .eq("client_message_id", message.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return mapStoredMessage(existing);

  const { data, error } = await supabase
    .from("chat_messages")
    .insert([
      {
        thread_id: threadId,
        role: "user",
        parts: message.parts,
        client_message_id: message.id,
      },
    ])
    .select("id, role, parts")
    .single();

  if (error) throw error;
  return mapStoredMessage(data);
}

export async function loadCanonicalChatMessages(
  supabase: SupabaseClient,
  threadId: string,
  limit: number,
): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, parts, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapStoredMessage);
}

export async function updateThreadTitle(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim().slice(0, 120) || "New chat";
  const { error } = await supabase
    .from("chat_threads")
    .update({ title: trimmed })
    .eq("id", threadId)
    .eq("user_id", userId);
  if (error) throw error;
}

export function deriveThreadTitleFromMessage(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (!singleLine) return "New chat";
  return singleLine.length > 80 ? `${singleLine.slice(0, 77)}…` : singleLine;
}

export function extractTextFromUIMessage(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}
