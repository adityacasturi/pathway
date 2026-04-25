"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RetryButton({
  onClick,
  disabled,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      disabled={disabled}
      className={cn("h-6 px-2 text-[10px] uppercase tracking-wider", className)}
    >
      <RefreshCcw className="size-3" />
      Retry
    </Button>
  );
}

export function InlineError({
  message,
  className,
  onRetry,
  retryDisabled,
}: {
  message: string;
  className?: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle className="size-3.5" />
        {message}
      </span>
      {onRetry && <RetryButton onClick={onRetry} disabled={retryDisabled} />}
    </div>
  );
}
