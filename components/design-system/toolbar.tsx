"use client";

import type { ReactNode } from "react";
import { filterPillClass } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="toolbar">
      {children}
    </div>
  );
}

export function FilterPill({
  children,
  active = false,
  onClick,
  className,
  type = "button",
  ...props
}: {
  children: ReactNode;
  active?: boolean;
  className?: string;
} & (
  | { type?: "button"; onClick?: () => void }
  | { type: "submit"; onClick?: never }
)) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(filterPillClass(active), className)}
      {...props}
    >
      {children}
    </button>
  );
}

/** Search + filters row above tables/lists */
export function DataToolbar({
  leading,
  trailing,
  footer,
  className,
}: {
  leading?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {leading ? <div className="min-w-0 flex-1">{leading}</div> : null}
        {trailing ? (
          <div className="flex flex-wrap items-center gap-2">{trailing}</div>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
