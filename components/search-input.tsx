"use client";

import { forwardRef } from "react";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  onFocusChange?: (focused: boolean) => void;
}

export const SearchInput = forwardRef<HTMLDivElement, Props>(function SearchInput(
  { value, onChange, placeholder, onFocusChange },
  ref,
) {
  return (
    <div ref={ref} className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-border/70 bg-background/80 pl-10 pr-10 text-base text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/55 focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-ring)_18%,transparent),inset_0_1px_0_rgb(255_255_255/0.08)] md:text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-foreground/8 hover:text-foreground"
          aria-label="Clear search"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
});
