"use client";

import { createPortal } from "react-dom";
import { type RefObject, useEffect, useState } from "react";
import { Command } from "lucide-react";
import { getActiveToken, replaceActiveToken } from "@/lib/ui/query";

export interface QuerySuggestion {
  token: string;
  label: string;
  hint: string;
}

interface Props {
  query: string;
  suggestions: QuerySuggestion[];
  onChange: (next: string) => void;
  onPick?: () => void;
  open?: boolean;
  anchorRef: RefObject<HTMLElement | null>;
}

interface PopupPosition {
  top: number;
  left: number;
  width: number;
}

export function QueryAutocomplete({
  query,
  suggestions,
  onChange,
  onPick,
  open = true,
  anchorRef,
}: Props) {
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [position, setPosition] = useState<PopupPosition | null>(null);
  const activeToken = getActiveToken(query);

  const matches = suggestions
    .filter((suggestion) => suggestion.token.toLowerCase().startsWith(activeToken))
    .slice(0, 4);

  const shouldRender =
    open &&
    query !== dismissedQuery &&
    Boolean(activeToken) &&
    activeToken.length >= 2 &&
    matches.length > 0 &&
    !matches.some((suggestion) => suggestion.token.toLowerCase() === activeToken);

  useEffect(() => {
    if (!shouldRender) return;

    const anchor = anchorRef.current;
    if (!anchor) return;

    function updatePosition() {
      const nextAnchor = anchorRef.current;
      if (!nextAnchor) return;
      const rect = nextAnchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 7,
        left: rect.left,
        width: rect.width,
      });
    }

    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(anchor);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, shouldRender]);

  if (!shouldRender || !position) return null;

  return createPortal(
    <div
      className="fixed z-[260] max-h-64 overflow-y-auto rounded-xl border border-border/80 bg-popover/98 p-1.5 shadow-[0_24px_60px_-32px_rgb(15_23_42/0.68)] backdrop-blur-xl"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
      }}
    >
      {matches.map((suggestion) => (
        <button
          key={suggestion.token}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            const next = replaceActiveToken(query, suggestion.token);
            setDismissedQuery(next);
            onChange(next);
            onPick?.();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-foreground/5"
        >
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/50 text-muted-foreground">
            <Command size={13} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{suggestion.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{suggestion.hint}</span>
          </span>
          <code className="shrink-0 rounded-md border border-border/70 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground">
            {suggestion.token}
          </code>
        </button>
      ))}
    </div>,
    document.body,
  );
}
