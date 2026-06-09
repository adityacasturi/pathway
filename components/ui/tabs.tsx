"use client";

import { UI_SELECTED } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex w-full items-center gap-0.5 rounded-lg border border-border bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
              active
                ? cn(UI_SELECTED, "shadow-[inset_0_0_0_1px_var(--selection-border)]")
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
