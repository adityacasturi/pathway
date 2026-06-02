"use client";

import { createElement } from "react";
import { getDiscoverIndustryIcon } from "@/lib/discover/industry-icons";
import { cn } from "@/lib/utils";

export function IndustryIcon({ slug, className }: { slug: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center text-muted-foreground",
        className,
      )}
    >
      {createElement(getDiscoverIndustryIcon(slug), {
        className: "size-3.5",
        strokeWidth: 1.75,
        "aria-hidden": true,
      })}
    </span>
  );
}
