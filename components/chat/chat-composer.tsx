"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/ui/inline-error";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CHAT_ASSISTANT_NAME } from "@/lib/chat/assistant";
import { cn } from "@/lib/utils";

function ChatComposerDisclaimer() {
  return (
    <p className="mx-auto mt-2.5 max-w-2xl text-center text-[11px] leading-relaxed text-muted-foreground/70">
      {CHAT_ASSISTANT_NAME} is in beta. Responses may be inaccurate or incomplete.
    </p>
  );
}

function useAutoResizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  return ref;
}

export function ChatComposer({
  disabled,
  isStreaming,
  error,
  onClearError,
  onSend,
  onStop,
  initialValue = "",
  className,
}: {
  disabled?: boolean;
  isStreaming: boolean;
  error?: string | null;
  onClearError?: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  initialValue?: string;
  className?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useAutoResizeTextarea(value);
  const canSend = !disabled && !isStreaming && value.trim().length > 0;

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled || isStreaming) return;
    onSend(text);
    setValue("");
  }, [disabled, isStreaming, onSend, value]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <div className={cn("shrink-0", className)}>
      {error ? (
        <div className="mb-3">
          <InlineError message={error} onRetry={onClearError} />
        </div>
      ) : null}

      <ChatPanel focusable className="p-2">
        <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about your applications or find openings…"
            rows={1}
            disabled={disabled}
            className="min-h-[52px] max-h-40 resize-none border-0 bg-transparent px-3 py-3 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 [&:not(:placeholder-shown)]:text-foreground"
          />

          <div className="mt-1.5 flex items-center justify-between gap-3 px-2 pb-0.5">
            <p className="hidden text-[11px] text-muted-foreground/65 sm:block">
              <kbd className="rounded border border-border bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-1 py-px font-mono text-[10px]">
                Enter
              </kbd>{" "}
              to send ·{" "}
              <kbd className="rounded border border-border bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-1 py-px font-mono text-[10px]">
                Shift+Enter
              </kbd>{" "}
              for new line
            </p>
            <p className="text-[11px] text-muted-foreground/65 sm:hidden">Enter to send</p>

            {isStreaming ? (
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="size-10 shrink-0 rounded-full border-[color-mix(in_oklab,var(--destructive)_30%,var(--border))] bg-[color-mix(in_oklab,var(--destructive)_6%,var(--card))] text-destructive hover:bg-[color-mix(in_oklab,var(--destructive)_12%,var(--card))]"
                onClick={onStop}
                aria-label="Stop"
              >
                <Square size={15} fill="currentColor" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-lg"
                className={cn(
                  "size-10 shrink-0 rounded-full transition-[transform,box-shadow,opacity] duration-150",
                  canSend
                    ? "primary-surface scale-100 hover:brightness-105 active:scale-95"
                    : "border border-border bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)] text-muted-foreground/50 shadow-none hover:bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)]",
                )}
                onClick={submit}
                disabled={!canSend}
                aria-label="Send"
              >
                <ArrowUp size={17} strokeWidth={2.25} />
              </Button>
            )}
          </div>
      </ChatPanel>
      <ChatComposerDisclaimer />
    </div>
  );
}
