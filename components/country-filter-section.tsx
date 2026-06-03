"use client";

import { FilterSection } from "@/components/ui/filter-menu";
import { FilterChip } from "@/components/ui/filter-chip";
import type { CountryFilterOption } from "@/lib/feed/country-filter";

export function CountryFilterSection({
  options,
  selected,
  onToggle,
  onClear,
}: {
  options: CountryFilterOption[];
  selected: ReadonlySet<string>;
  onToggle: (code: string) => void;
  onClear: () => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <FilterSection
      title="Country"
      action={
        selected.size > 0
          ? { label: "Clear", onClick: onClear }
          : undefined
      }
    >
      <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
        {options.map((option) => (
          <FilterChip
            key={option.code}
            label={option.label}
            count={option.count}
            active={selected.has(option.code)}
            onClick={() => onToggle(option.code)}
          />
        ))}
      </div>
    </FilterSection>
  );
}
