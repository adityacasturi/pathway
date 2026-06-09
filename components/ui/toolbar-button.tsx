"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { toolbarButtonClass } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function ToolbarButton({
  children,
  active,
  className,
  ...props
}: {
  children: ReactNode;
  active?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cn(toolbarButtonClass(Boolean(active)), className)} {...props}>
      {children}
    </button>
  );
}
