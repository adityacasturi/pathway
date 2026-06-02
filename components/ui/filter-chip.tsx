"use client";

import { cn } from "@/lib/utils";

export function FilterChip({
  label,
  count,
  active,
  onClick,
  className,
  tone = "default",
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  className?: string;
  tone?: "default" | "toolbar";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors",
        tone === "toolbar"
          ? "font-mono text-[10px] font-medium uppercase tracking-[0.14em]"
          : "text-[13px] font-medium",
        active
          ? tone === "toolbar"
            ? "border-foreground bg-foreground text-background"
            : "border-foreground/20 bg-foreground/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {label}
      {count !== undefined ? (
        <span className="label-meta tabular-nums opacity-80">{count}</span>
      ) : null}
    </button>
  );
}
