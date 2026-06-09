"use client";

import type { CSSProperties, ReactNode } from "react";
import { UI_CHIP_COUNT_SELECTED, UI_CHIP_SELECTED } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function Chip({
  label,
  count,
  active,
  onClick,
  className,
  tone = "default",
  prefix,
  title,
  style,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  className?: string;
  tone?: "default" | "toolbar";
  prefix?: ReactNode;
  title?: string;
  style?: CSSProperties;
}) {
  const customTone = style != null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      style={customTone ? style : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 transition-colors duration-150",
        tone === "toolbar"
          ? "font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
          : "text-[13px] font-medium",
        customTone
          ? active
            ? "font-medium"
            : "hover:brightness-[0.98]"
          : active
            ? UI_CHIP_SELECTED
            : "border-border bg-card text-muted-foreground hover:border-[color-mix(in_oklab,var(--primary)_20%,var(--border))] hover:text-foreground",
        className,
      )}
    >
      {prefix}
      <span>{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
            customTone
              ? "bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] text-foreground/70"
              : active
                ? UI_CHIP_COUNT_SELECTED
                : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
