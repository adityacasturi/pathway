import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { ChatThreadNotFoundError, assertThreadOwnership } from "@/lib/chat/assert-thread-ownership";
import {
  extractTextFromUIMessage,
  loadCanonicalChatMessages,
  persistChatMessages,
  persistUserChatMessage,
  updateThreadTitle,
} from "@/lib/chat/persist";
import { generateThreadTitleFromMessage } from "@/lib/chat/thread-title";
import { limitChatByIp, limitChatByUser } from "@/lib/chat/rate-limit";
import { buildChatSystemPrompt } from "@/lib/chat/system-prompt";
import { chatTools } from "@/lib/chat/tools";
import {
  MAX_CHAT_HISTORY_MESSAGES,
  parseChatRequestBody,
} from "@/lib/chat/request";
import { SCOUT_ENABLED } from "@/lib/config/scout";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!SCOUT_ENABLED) {
    return new Response("Scout is not available yet", { status: 503 });
  }

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [userLimit, ipLimit] = await Promise.all([
    limitChatByUser(user.id),
    limitChatByIp(),
  ]);

  if (!userLimit.ok || !ipLimit.ok) {
    return new Response("Too many requests", { status: 429 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response("Chat is not configured", { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = parseChatRequestBody(body);
  if (!parsed.success) {
    return new Response("Invalid request", { status: 400 });
  }

  const { threadId, message } = parsed.data;

  try {
    await assertThreadOwnership(supabase, threadId, user.id);
  } catch (error) {
    if (error instanceof ChatThreadNotFoundError) {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }

  let titleGeneration: Promise<void> | null = null;
  const persistedUserMessage = await persistUserChatMessage(
    supabase,
    threadId,
    user.id,
    message as UIMessage,
  );
  const uiMessages = await loadCanonicalChatMessages(
    supabase,
    threadId,
    MAX_CHAT_HISTORY_MESSAGES,
  );

  const { count } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId);

  if ((count ?? 0) <= 1) {
    const firstMessageText = extractTextFromUIMessage(persistedUserMessage);
    titleGeneration = generateThreadTitleFromMessage(firstMessageText).then(async (title) => {
      await updateThreadTitle(supabase, threadId, user.id, title);
    });
  }

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: buildChatSystemPrompt(),
    messages: await convertToModelMessages(uiMessages),
    tools: chatTools(
      supabase,
      { userId: user.id, threadId },
      { latestUserMessage: extractTextFromUIMessage(persistedUserMessage) },
    ),
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted || responseMessage.role !== "assistant") {
        return;
      }

      await persistChatMessages(supabase, threadId, user.id, [responseMessage]);

      if (titleGeneration) {
        await titleGeneration.catch(async () => {
          const firstUserMessage = uiMessages.find((message) => message.role === "user");
          if (!firstUserMessage) return;

          const { data: thread } = await supabase
            .from("chat_threads")
            .select("title")
            .eq("id", threadId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (thread?.title !== "New chat") return;

          const title = await generateThreadTitleFromMessage(
            extractTextFromUIMessage(firstUserMessage),
          );
          await updateThreadTitle(supabase, threadId, user.id, title);
        });
      }
    },
  });
}
