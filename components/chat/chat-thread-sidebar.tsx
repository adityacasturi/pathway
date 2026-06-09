"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import type { ChatThreadRow } from "@/lib/chat/types";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/design-system/states";
import {
  chatHeaderClassName,
  chatHeaderHighlightClassName,
} from "@/components/chat/chat-panel";
import { cn } from "@/lib/utils";

export function ChatThreadSidebar({
  threads,
  activeThreadId,
  query,
  onQueryChange,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  deletePendingId,
  newThreadPending,
}: {
  threads: ChatThreadRow[];
  activeThreadId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread: (threadId: string) => void;
  deletePendingId?: string | null;
  newThreadPending?: boolean;
}) {
  const filtered = threads.filter((thread) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return thread.title.toLowerCase().includes(q);
  });

  const sidebarInsetX = "px-3";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-gradient-to-b from-[color-mix(in_oklab,var(--primary)_3%,var(--card))] to-card xl:w-[22rem] xl:shrink-0">
      <div className={chatHeaderClassName(cn("gap-2", sidebarInsetX))}>
        <div className={chatHeaderHighlightClassName()} aria-hidden />
        <div className="min-w-0 flex-1">
          <SearchInput value={query} onChange={onQueryChange} placeholder="Search threads" />
        </div>
        <Button
          type="button"
          className="h-10 shrink-0 primary-surface px-3"
          onClick={onNewThread}
          disabled={newThreadPending}
        >
          {newThreadPending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Plus size={16} strokeWidth={2.25} aria-hidden />
          )}
          {newThreadPending ? "Starting…" : "New chat"}
        </Button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto pb-3 pt-4", sidebarInsetX)}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            description="Start a chat to ask about your applications or discover openings."
            primaryAction={{ label: "Start chatting", onClick: onNewThread }}
            className="m-2 border-0 bg-transparent"
          />
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((thread) => {
              const active = thread.id === activeThreadId;
              return (
                <li key={thread.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelectThread(thread.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 pr-10 text-left transition-colors",
                      active
                        ? "border border-[var(--selection-border)] bg-[var(--selection-bg)] text-[var(--selection-fg)]"
                        : "border border-transparent text-muted-foreground hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] hover:text-foreground",
                    )}
                  >
                    <p
                      className={cn(
                        "min-w-0 truncate text-sm",
                        active ? "font-medium text-foreground" : "font-normal",
                      )}
                    >
                      {thread.title}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute top-1/2 right-2 size-7 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100",
                      deletePendingId === thread.id && "opacity-100",
                    )}
                    aria-label={`Delete ${thread.title}`}
                    disabled={deletePendingId === thread.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
