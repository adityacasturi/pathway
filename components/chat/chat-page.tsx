"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createChatThread,
  deleteChatThread,
  getChatThreadTitle,
  loadChatThreadMessages,
} from "@/lib/actions/chat";
import type { ChatThreadRow } from "@/lib/chat/types";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatEmptyStart, ChatMessageList } from "@/components/chat/chat-message-list";
import { ChatThreadSidebar } from "@/components/chat/chat-thread-sidebar";
import { ChatToolbar } from "@/components/chat/chat-toolbar";
import { DetailDrawer } from "@/components/design-system/detail-drawer";
import { LoadingState } from "@/components/design-system/states";
import { PageShell } from "@/components/design-system/page";
import { Button } from "@/components/ui/button";

function ChatNoActiveThread({
  onNewThread,
  onStarterPrompt,
  pending,
}: {
  onNewThread: () => void;
  onStarterPrompt?: (prompt: string) => void;
  pending?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
      <div className="w-full max-w-2xl text-center">
        <ChatEmptyStart onPromptSelect={onStarterPrompt} />
        <Button
          type="button"
          size="sm"
          className="mt-7 h-10 primary-surface"
          onClick={onNewThread}
          disabled={pending}
        >
          <Plus size={14} />
          {pending ? "Starting…" : "New chat"}
        </Button>
      </div>
    </div>
  );
}

function ChatConversation({
  threadId,
  threadTitle,
  initialQuery,
  trackedUrls,
  savedIds,
  onOpenThreads,
  onThreadTitleUpdated,
  onInitialQueryConsumed,
}: {
  threadId: string;
  threadTitle: string;
  initialQuery: string;
  trackedUrls: string[];
  savedIds: string[];
  onOpenThreads: () => void;
  onThreadTitleUpdated: (threadId: string, title: string) => void;
  onInitialQueryConsumed?: () => void;
}) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        prepareSendMessagesRequest: ({ messages, body }) => {
          const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
          return {
            body: {
              threadId: body?.threadId ?? threadId,
              message: latestUserMessage,
            },
          };
        },
      }),
    [threadId],
  );

  const shouldRefreshTitleRef = useRef(threadTitle === "New chat");

  const { messages, sendMessage, status, stop, error, setMessages, clearError } = useChat({
    id: threadId,
    transport,
    messages: initialMessages,
    onFinish: () => {
      if (!shouldRefreshTitleRef.current) return;
      shouldRefreshTitleRef.current = false;
      void (async () => {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const result = await getChatThreadTitle(threadId);
          if ("error" in result) return;
          if (result.title !== "New chat") {
            onThreadTitleUpdated(threadId, result.title);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      })();
    },
  });

  useEffect(() => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    let cancelled = false;

    (async () => {
      setLoadingThread(true);
      setActionError(null);
      try {
        const result = await loadChatThreadMessages(threadId);
        if (cancelled || loadRequestRef.current !== requestId) return;
        if ("error" in result) {
          setActionError(result.error);
          setMessages([]);
          return;
        }
        setInitialMessages(result.messages);
        setMessages(result.messages);
      } catch (loadError) {
        if (cancelled || loadRequestRef.current !== requestId) return;
        setMessages([]);
        setActionError(
          loadError instanceof Error ? loadError.message : "Unable to load conversation.",
        );
      } finally {
        if (!cancelled && loadRequestRef.current === requestId) {
          setLoadingThread(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setMessages, threadId]);

  const handleSend = useCallback(
    (text: string) => {
      setActionError(null);
      void sendMessage({ text });
    },
    [sendMessage],
  );

  const bootstrappedQueryRef = useRef(false);
  useEffect(() => {
    bootstrappedQueryRef.current = false;
  }, [threadId]);

  useEffect(() => {
    const q = initialQuery.trim();
    if (!q || bootstrappedQueryRef.current || loadingThread || messages.length > 0) return;
    bootstrappedQueryRef.current = true;
    handleSend(q);
    onInitialQueryConsumed?.();
  }, [handleSend, initialQuery, loadingThread, messages.length, onInitialQueryConsumed, threadId]);

  if (loadingThread && messages.length === 0) {
    return <LoadingState label="Loading conversation…" className="m-5 flex-1" />;
  }

  const isNewChat = messages.length === 0 && status === "ready";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatToolbar title={threadTitle} onOpenThreads={onOpenThreads} />
      {isNewChat ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
          <div className="w-full max-w-2xl">
            <ChatEmptyStart onPromptSelect={handleSend} />
            <ChatComposer
              disabled={loadingThread}
              isStreaming={false}
              error={actionError}
              onClearError={() => setActionError(null)}
              onSend={handleSend}
              onStop={stop}
              initialValue={initialQuery}
              className="mt-7"
            />
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <ChatMessageList
            messages={messages}
            status={status}
            error={error}
            onRetry={clearError}
            trackedUrls={trackedUrls}
            savedIds={savedIds}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-card from-50% via-card/90 to-transparent px-5 pb-6 pt-8 md:pb-8">
            <ChatComposer
              disabled={loadingThread}
              isStreaming={status === "streaming" || status === "submitted"}
              error={actionError}
              onClearError={() => setActionError(null)}
              onSend={handleSend}
              onStop={stop}
              initialValue={initialQuery}
              className="pointer-events-auto mx-auto w-full max-w-3xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatPage({
  initialThreads,
  trackedUrls,
  savedIds,
}: {
  initialThreads: ChatThreadRow[];
  trackedUrls: string[];
  savedIds: string[];
}) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    initialThreads[0]?.id ?? null,
  );
  const [threadQuery, setThreadQuery] = useState("");
  const [mobileThreadsOpen, setMobileThreadsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [newThreadPending, setNewThreadPending] = useState(false);
  const [pendingStarterQuery, setPendingStarterQuery] = useState<string | null>(null);
  const newThreadInFlightRef = useRef(false);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const conversationInitialQuery = pendingStarterQuery ?? initialQuery;

  const handleNewThread = useCallback(async () => {
    if (newThreadInFlightRef.current) return;
    newThreadInFlightRef.current = true;
    setActionError(null);
    setNewThreadPending(true);
    const result = await createChatThread();
    newThreadInFlightRef.current = false;
    setNewThreadPending(false);
    if ("error" in result) {
      setActionError(result.error);
      return;
    }
    setThreads((current) => [result.thread, ...current]);
    setActiveThreadId(result.thread.id);
    setMobileThreadsOpen(false);
  }, []);

  const handleStarterPrompt = useCallback(
    async (prompt: string) => {
      if (newThreadInFlightRef.current) return;
      newThreadInFlightRef.current = true;
      setActionError(null);
      setNewThreadPending(true);
      const result = await createChatThread();
      newThreadInFlightRef.current = false;
      setNewThreadPending(false);
      if ("error" in result) {
        setActionError(result.error);
        toast.error("Couldn't start chat", { description: result.error });
        return;
      }
      setThreads((current) => [result.thread, ...current]);
      setActiveThreadId(result.thread.id);
      setPendingStarterQuery(prompt);
      setMobileThreadsOpen(false);
    },
    [],
  );

  const handleSelectThread = useCallback((threadId: string) => {
    setPendingStarterQuery(null);
    setActiveThreadId(threadId);
    setMobileThreadsOpen(false);
  }, []);

  const handleThreadTitleUpdated = useCallback((threadId: string, title: string) => {
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, title } : thread)),
    );
  }, []);

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      setActionError(null);
      setDeletePendingId(threadId);
      const result = await deleteChatThread(threadId);
      setDeletePendingId(null);

      if ("error" in result) {
        setActionError(result.error);
        toast.error("Couldn't delete chat", { description: result.error });
        return;
      }

      const remaining = threads.filter((thread) => thread.id !== threadId);
      const wasActive = activeThreadId === threadId;

      setThreads(remaining);
      setMobileThreadsOpen(false);
      toast.success("Chat deleted");

      if (!wasActive) return;

      if (remaining.length > 0) {
        setActiveThreadId(remaining[0].id);
        return;
      }

      setActiveThreadId(null);
    },
    [activeThreadId, threads],
  );

  return (
    <PageShell className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-card">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_7%,transparent),transparent_52%)]"
            aria-hidden
          />
          <div className="relative flex min-h-0 flex-1">
            <div className="hidden border-r border-border xl:flex">
              <ChatThreadSidebar
                threads={threads}
                activeThreadId={activeThreadId}
                query={threadQuery}
                onQueryChange={setThreadQuery}
                onSelectThread={handleSelectThread}
                onNewThread={() => void handleNewThread()}
                onDeleteThread={(threadId) => void handleDeleteThread(threadId)}
                deletePendingId={deletePendingId}
                newThreadPending={newThreadPending}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {actionError ? (
                <div className="border-b border-border px-5 py-2 text-sm text-destructive">
                  {actionError}
                </div>
              ) : null}
              {activeThreadId && activeThread ? (
                <ChatConversation
                  key={activeThreadId}
                  threadId={activeThreadId}
                  threadTitle={activeThread.title}
                  initialQuery={conversationInitialQuery}
                  trackedUrls={trackedUrls}
                  savedIds={savedIds}
                  onOpenThreads={() => setMobileThreadsOpen(true)}
                  onThreadTitleUpdated={handleThreadTitleUpdated}
                  onInitialQueryConsumed={() => setPendingStarterQuery(null)}
                />
              ) : (
                <ChatNoActiveThread
                  onNewThread={() => void handleNewThread()}
                  onStarterPrompt={(prompt) => void handleStarterPrompt(prompt)}
                  pending={newThreadPending}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {mobileThreadsOpen ? (
        <DetailDrawer
          variant="overlay"
          title="Conversations"
          onClose={() => setMobileThreadsOpen(false)}
          className="max-w-sm"
        >
          <ChatThreadSidebar
            threads={threads}
            activeThreadId={activeThreadId}
            query={threadQuery}
            onQueryChange={setThreadQuery}
            onSelectThread={handleSelectThread}
            onNewThread={() => void handleNewThread()}
            onDeleteThread={(threadId) => void handleDeleteThread(threadId)}
            deletePendingId={deletePendingId}
            newThreadPending={newThreadPending}
          />
        </DetailDrawer>
      ) : null}
    </PageShell>
  );
}
