import type { UIMessage } from "ai";
import { z } from "zod";

export const MAX_CHAT_HISTORY_MESSAGES = 80;
export const MAX_CHAT_PARTS_PER_MESSAGE = 40;
export const MAX_CHAT_USER_TEXT_CHARS = 20_000;

const userTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(20_000),
});

const userMessageSchema = z
  .object({
    id: z.string().min(1).max(200),
    role: z.literal("user"),
    parts: z.array(userTextPartSchema).min(1).max(MAX_CHAT_PARTS_PER_MESSAGE),
  })
  .superRefine((message, context) => {
    const totalTextLength = message.parts.reduce((sum, part) => sum + part.text.length, 0);
    if (totalTextLength > MAX_CHAT_USER_TEXT_CHARS) {
      context.addIssue({
        code: "custom",
        message: "Message is too long.",
        path: ["parts"],
      });
    }

    if (!message.parts.some((part) => part.text.trim().length > 0)) {
      context.addIssue({
        code: "custom",
        message: "Message is required.",
        path: ["parts"],
      });
    }
  });

const chatRequestSchema = z
  .object({
    threadId: z.string().uuid(),
    message: userMessageSchema,
  })
  .strict();

export type ParsedChatRequest = z.infer<typeof chatRequestSchema>;

export function parseChatRequestBody(body: unknown) {
  return chatRequestSchema.safeParse(body);
}

export function buildModelMessagesForChatRequest(
  canonicalHistory: UIMessage[],
  persistedUserMessage: UIMessage,
): UIMessage[] {
  return [...canonicalHistory, persistedUserMessage].slice(-MAX_CHAT_HISTORY_MESSAGES);
}
