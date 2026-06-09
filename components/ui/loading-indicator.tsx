"use client";

import { cn } from "@/lib/utils";

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-3.5 w-3.5 rounded-full border border-current border-t-transparent animate-spin",
        className,
      )}
    />
  );
}
