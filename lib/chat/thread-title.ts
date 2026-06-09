import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { deriveThreadTitleFromMessage } from "./persist.ts";

function sanitizeGeneratedTitle(raw: string): string {
  const title = raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return "New chat";
  return title.length > 80 ? `${title.slice(0, 77)}…` : title;
}

export async function generateThreadTitleFromMessage(messageText: string): Promise<string> {
  const trimmed = messageText.replace(/\s+/g, " ").trim();
  if (!trimmed) return "New chat";

  if (!process.env.OPENAI_API_KEY) {
    return deriveThreadTitleFromMessage(trimmed);
  }

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system:
        "You name chat conversations in a concise title (3-6 words). Reply with only the title — no quotes, punctuation wrappers, or explanation. The app is Pathway, an internship tracker; Scout is the assistant.",
      prompt: trimmed.slice(0, 2000),
      maxOutputTokens: 24,
    });

    return sanitizeGeneratedTitle(text);
  } catch {
    return deriveThreadTitleFromMessage(trimmed);
  }
}
