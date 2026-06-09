"use client";

import { Loader2 } from "lucide-react";
import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import { ChatToolResultBlock } from "@/components/chat/blocks/chat-tool-result";
import { ScoutAvatar, chatUserBubbleClassName } from "@/components/chat/chat-panel";
import { CHAT_ASSISTANT_NAME } from "@/lib/chat/assistant";
import {
  extractToolResultsFromMessage,
  getToolResultRenderKey,
  toolStatusLabel,
} from "@/lib/chat/parse-tool-parts";
import { InlineMarkdownText } from "@/components/chat/inline-markdown-text";
import { cn } from "@/lib/utils";
import type { ChatToolResult } from "@/lib/chat/types";

function AssistantHeader({ loading = false }: { loading?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <ScoutAvatar loading={loading} />
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground">{CHAT_ASSISTANT_NAME}</p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Thinking…</p>
        ) : null}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-[color-mix(in_oklab,var(--primary)_55%,var(--muted-foreground))] animate-bounce"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </div>
  );
}

export function PendingAssistantMessage({ label = "Thinking…" }: { label?: string }) {
  return (
    <div className="space-y-3">
      <AssistantHeader loading />
      <ThinkingDots />
      <p className="sr-only">{label}</p>
    </div>
  );
}

function hasStructuredToolResults(toolResults: ChatToolResult[]): boolean {
  return toolResults.length > 0;
}

function looksLikeDuplicateListing(text: string): boolean {
  return /(?:^|\s)(?:\d+\.|\*\s+-|\*\s+\*\*)/.test(text);
}

/** Keep a short intro when structured blocks will show the rows. */
function compactToolBackedText(text: string): string {
  const numberedListStart = text.search(/(?:^|\s)(?:\d+\.|\*\s+-|\*\s+\*\*)/);
  if (numberedListStart <= 0) {
    return text;
  }

  const intro = text.slice(0, numberedListStart).trim().replace(/:\s*$/, ".");
  return intro.length > 0 ? intro : text;
}

function splitAssistantText(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const explicitBlocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (explicitBlocks.length > 1) return explicitBlocks;

  const numberedListStart = normalized.search(/\s(?:\d+)\.\s+/);
  if (numberedListStart <= 0) return [normalized];

  const intro = normalized.slice(0, numberedListStart).trim().replace(/:\s*$/, ".");
  const listText = normalized.slice(numberedListStart).trim();
  const items = listText
    .split(/(?=\b\d+\.\s+)/)
    .map((item) => item.trim())
    .filter(Boolean);

  return [intro, ...items].filter(Boolean);
}

export function ChatMessage({
  message,
  isStreaming = false,
  trackedUrls,
  savedIds,
}: {
  message: UIMessage;
  isStreaming?: boolean;
  trackedUrls: string[];
  savedIds: string[];
}) {
  const text = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");

  const toolResults = extractToolResultsFromMessage(message);
  const shouldCompactProse =
    hasStructuredToolResults(toolResults) ||
    (isStreaming && looksLikeDuplicateListing(text));
  const displayText = shouldCompactProse ? compactToolBackedText(text) : text;
  const displayTextBlocks = splitAssistantText(displayText);
  const showToolBlocks = !isStreaming && toolResults.length > 0;
  const pendingTools = message.parts
    .filter((part) => isToolUIPart(part))
    .map((part) => toolStatusLabel(part))
    .filter((label): label is string => Boolean(label));

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className={chatUserBubbleClassName()}>{text}</div>
      </div>
    );
  }

  const hasContent = displayTextBlocks.length > 0 || pendingTools.length > 0 || toolResults.length > 0;

  if (!hasContent && isStreaming) {
    return <PendingAssistantMessage />;
  }

  return (
    <div className="space-y-3">
      <AssistantHeader />
      {displayTextBlocks.map((block, index) => (
        <p
          key={`${index}-${block.slice(0, 24)}`}
          className={cn("text-sm leading-relaxed text-foreground", isStreaming && "animate-pulse")}
        >
          <InlineMarkdownText text={block} />
          {isStreaming && index === displayTextBlocks.length - 1 ? (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary/70" />
          ) : null}
        </p>
      ))}
      {pendingTools.map((label, index) => (
        <div key={`${label}-${index}`} className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin text-muted-foreground" aria-hidden />
          <span>{label}</span>
        </div>
      ))}
      {showToolBlocks
        ? toolResults.map((result) => (
            <ChatToolResultBlock
              key={getToolResultRenderKey(result)}
              result={result}
              trackedUrls={trackedUrls}
              savedIds={savedIds}
            />
          ))
        : null}
    </div>
  );
}
