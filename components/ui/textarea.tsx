"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-[2.75rem] w-full min-w-0 resize-none rounded-lg border border-border bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] px-3 py-2 text-base text-foreground outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus-visible:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--primary)_25%,transparent)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
