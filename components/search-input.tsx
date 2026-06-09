"use client";

import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <Input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        placeholder={placeholder}
        className="h-10 rounded-lg border-border bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)] pl-10 pr-10 shadow-none"
      />
      {value && (
        <Button
          type="button"
          onClick={() => onChange("")}
          variant="ghost"
          size="icon-xs"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
          aria-label="Clear search"
        >
          <X size={14} strokeWidth={1.8} />
        </Button>
      )}
    </div>
  );
});
