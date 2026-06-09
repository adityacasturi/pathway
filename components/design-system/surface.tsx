import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** White/near-white panel with thin border — no shadow by default. */
export function Surface({
  children,
  className,
  padding = "p-4",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "ds-surface rounded-lg border border-border bg-card",
        interactive && "transition-colors hover:bg-muted/30",
        padding,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Stacked sections sharing one outer border */
export function SectionStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("section-stack overflow-hidden rounded-lg", className)}>{children}</div>
  );
}
