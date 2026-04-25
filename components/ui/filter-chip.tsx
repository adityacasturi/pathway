"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline filter chip. Reads as plain text ("Season · All ▾") rather than a
 * bordered button, which keeps filter bars visually quiet until the user
 * interacts. Clicking opens a small menu anchored to the chip.
 *
 * Uses @base-ui/react/select under the hood so keyboard nav / ARIA semantics
 * are handled for us. This local variant deliberately strips the usual field
 * border so it sits quietly next to a search input.
 */

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /**
   * Optional Tailwind accent classes applied when this value is the
   * current selection. Used for season options so the chip tints
   * accent colour when set.
   */
  accent?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: FilterOption<T>[];
  onChange: (next: T) => void;
  /**
   * The value treated as "unset". When `value === defaultValue`, the chip
   * reads muted. When different, the chip picks up the option's accent (or
   * falls back to foreground).
   */
  defaultValue: T;
  className?: string;
}

export function FilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
  defaultValue,
  className,
}: Props<T>) {
  const selected = options.find((o) => o.value === value);
  const active = value !== defaultValue;
  const accent = active ? selected?.accent : undefined;

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => onChange(next as T)}
    >
      <SelectPrimitive.Trigger
        data-active={active ? "true" : undefined}
        className={cn(
          "group/filter inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm outline-none transition-[border-color,background-color,color,box-shadow] duration-150",
          "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-background/60 hover:text-foreground",
          "focus-visible:border-border/70 focus-visible:bg-background/60 focus-visible:text-foreground focus-visible:shadow-[0_10px_24px_-18px_rgb(15_23_42/0.5)]",
          active && !accent && "border-foreground/15 bg-accent/55 text-foreground",
          accent,
          className,
        )}
      >
        <span className={cn("text-muted-foreground/80", active && "opacity-80")}>
          {label}
        </span>
        <span className="font-medium">{selected?.label ?? "—"}</span>
        <SelectPrimitive.Icon
          render={
            <ChevronDown
              size={13}
              className="opacity-60 transition-transform duration-150 group-data-popup-open/filter:rotate-180"
            />
          }
        />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          sideOffset={6}
          align="start"
          className="fixed isolate z-50"
        >
          <SelectPrimitive.Popup
            className={cn(
              "min-w-44 origin-(--transform-origin) rounded-xl border border-border/80 bg-popover/95 p-1.5 text-sm shadow-[0_24px_48px_-28px_rgb(15_23_42/0.65)] backdrop-blur-xl",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 duration-150 ease-out",
              "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            )}
          >
            <SelectPrimitive.List>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 pr-7 outline-none select-none",
                    "text-muted-foreground",
                    "data-highlighted:bg-foreground/5 data-highlighted:text-foreground",
                    option.accent,
                  )}
                >
                  <SelectPrimitive.ItemText className="flex-1">
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator
                    render={
                      <Check
                        size={14}
                        className="absolute right-2 text-foreground"
                      />
                    }
                  />
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
