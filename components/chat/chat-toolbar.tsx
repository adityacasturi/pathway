"use client";

import { Menu } from "lucide-react";
import { ScoutAvatar, chatHeaderClassName, chatHeaderHighlightClassName } from "@/components/chat/chat-panel";
import { Button } from "@/components/ui/button";

export function ChatToolbar({
  title,
  onOpenThreads,
}: {
  title: string;
  onOpenThreads?: () => void;
}) {
  return (
    <div className={chatHeaderClassName("justify-between gap-3 px-5")}>
      <div className={chatHeaderHighlightClassName()} aria-hidden />
      <div className="flex min-w-0 items-center gap-3">
        <ScoutAvatar />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground">{title}</h2>
          <p className="truncate text-[11px] text-muted-foreground/70">Scout conversation</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onOpenThreads ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[color-mix(in_oklab,var(--primary)_12%,var(--border))] xl:hidden"
            onClick={onOpenThreads}
          >
            <Menu size={14} />
            Threads
          </Button>
        ) : null}
      </div>
    </div>
  );
}
