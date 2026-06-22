"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  disabled,
  onCheckedChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-0.5",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-[var(--motion-ease-smooth)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-[color-mix(in_oklab,var(--switch-track-on)_40%,var(--border))] bg-[var(--switch-track-on)]"
          : "border-border bg-[var(--switch-track-off)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none size-4 shrink-0 rounded-full bg-[var(--switch-thumb)]",
          "shadow-[0_1px_3px_color-mix(in_oklab,var(--foreground)_22%,transparent)]",
          "ring-1 ring-[var(--switch-thumb-border)]",
          "transition-[margin] duration-200 ease-[var(--motion-ease-smooth)]",
          checked ? "ms-[calc(100%-1.125rem)]" : "ms-0.5",
        )}
      />
    </button>
  );
}
