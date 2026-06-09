"use client";

import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function FilterSection({
  title,
  action,
  children,
  compact = false,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        compact ? "px-4 py-3.5" : "px-4 py-4",
        !compact && "[&+section]:border-t",
      )}
      style={compact ? undefined : { borderColor: "var(--rule)" }}
    >
      <header className={cn("flex items-center justify-between", compact ? "mb-3" : "mb-4")}>
        <h3 className="text-base font-semibold text-foreground">
          {title}
        </h3>
        {action && (
          <Button
            type="button"
            onClick={action.onClick}
            variant="ghost"
            size="xs"
            className="text-xs text-muted-foreground"
          >
            {action.label}
          </Button>
        )}
      </header>
      {children}
    </section>
  );
}

export function SegmentedControl<T extends string>({
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
    <SegmentedTabs value={value} options={options} onChange={onChange} className={className} />
  );
}

export function FilterToggle({
  label,
  checked,
  onChange,
  compact = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer select-none items-center justify-between gap-3 rounded-md text-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]",
        compact ? "px-0 py-1.5 text-[13px]" : "gap-4 rounded-lg px-1.5 py-1.5 text-[12px]",
      )}
    >
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}
