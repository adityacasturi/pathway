"use client";

import { useCallback, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { ChatMessage, PendingAssistantMessage } from "@/components/chat/chat-message";
import { ScoutAvatar } from "@/components/chat/chat-panel";
import { ErrorState } from "@/components/design-system/states";
import { CHAT_ASSISTANT_NAME } from "@/lib/chat/assistant";
import { cn } from "@/lib/utils";

const STARTER_PROMPTS = [
  "Show my application pipeline",
  "Find SWE internships in New York",
  "Which companies have the most openings?",
  "What should I follow up on this week?",
] as const;

export function ChatEmptyStart({
  onPromptSelect,
}: {
  onPromptSelect?: (prompt: string) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <ScoutAvatar size="xl" />
      <h1 className="mt-6 max-w-xl text-balance text-2xl font-semibold tracking-tight text-foreground">
        Ask anything about your internship search
      </h1>
      {onPromptSelect ? (
        <div className="mt-6 flex w-full max-w-xl flex-wrap justify-center gap-2">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptSelect(prompt)}
              className={cn(
                "rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs font-medium text-foreground",
                "transition-colors hover:border-[color-mix(in_oklab,var(--primary)_28%,var(--border))] hover:bg-muted/50",
              )}
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChatMessageList({
  messages,
  status,
  error,
  onRetry,
  trackedUrls,
  savedIds,
}: {
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  error?: Error;
  onRetry?: () => void;
  trackedUrls: string[];
  savedIds: string[];
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const hasPendingAssistant =
    status === "submitted" && messages.at(-1)?.role === "user";

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = scrollContainerRef.current;
    if (!container || !stickToBottomRef.current) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    lastScrollTopRef.current = container.scrollTop;
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (container.scrollTop < lastScrollTopRef.current - 1) {
      stickToBottomRef.current = false;
    }
    lastScrollTopRef.current = container.scrollTop;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 48) {
      stickToBottomRef.current = true;
    }
  }, []);

  const releaseStickToBottom = useCallback(() => {
    stickToBottomRef.current = false;
  }, []);

  useEffect(() => {
    if (messages.at(-1)?.role === "user") {
      stickToBottomRef.current = true;
    }

    if (!stickToBottomRef.current) return;

    const behavior =
      status === "streaming" || status === "submitted" ? "auto" : "smooth";
    scrollToBottom(behavior);
  }, [messages, status, scrollToBottom]);

  if (messages.length === 0 && status === "ready") {
    return (
      <div className="flex flex-1 items-center justify-center px-5 py-8">
        <ChatEmptyStart />
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      onWheel={(event) => {
        if (event.deltaY < 0) releaseStickToBottom();
      }}
      onTouchMove={releaseStickToBottom}
      className="min-h-0 flex-1 overflow-y-auto overscroll-y-none px-5 pt-6 pb-52"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        {messages.length === 0 && status !== "ready" ? (
          <PendingAssistantMessage label={`${CHAT_ASSISTANT_NAME} is thinking…`} />
        ) : null}
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            isStreaming={
              status === "streaming" &&
              index === messages.length - 1 &&
              message.role === "assistant"
            }
            trackedUrls={trackedUrls}
            savedIds={savedIds}
          />
        ))}
        {hasPendingAssistant ? (
          <PendingAssistantMessage label="Reading your question…" />
        ) : null}
        {error ? (
          <ErrorState title="Something went wrong" message={error.message} onRetry={onRetry} />
        ) : null}
        <div aria-hidden className="h-px shrink-0" />
      </div>
    </div>
  );
}
