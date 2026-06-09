"use client";

import Link from "next/link";
import { ChatInsetCard } from "@/components/chat/chat-panel";
import type { ChatEmptyResult } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function EmptyResultBlock({ result }: { result: ChatEmptyResult }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{result.title}</p>
      <ChatInsetCard className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">{result.message}</p>
        {result.suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {result.suggestions.map((suggestion) => (
              <Link
                key={`${suggestion.label}-${suggestion.href}`}
                href={suggestion.href}
                className={cn(
                  "inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  "border-[color-mix(in_oklab,var(--primary)_12%,var(--border))]",
                  "bg-[color-mix(in_oklab,var(--primary)_3%,var(--card))]",
                  "text-primary hover:bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]",
                )}
              >
                {suggestion.label}
              </Link>
            ))}
          </div>
        ) : null}
      </ChatInsetCard>
    </div>
  );
}
