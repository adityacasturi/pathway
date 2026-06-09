import Link from "next/link";
import { ArrowRight, LayoutGrid, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const primaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium primary-surface transition-colors";

const outlineButtonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted";

export function HomeFirstRunBanner() {
  return (
    <div className="border-b border-border bg-[color-mix(in_oklab,var(--primary)_6%,var(--card))] px-5 py-4 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">Welcome to Pathway</p>
          <p className="text-sm text-muted-foreground">
            Track your first application or browse live openings to get started.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/applications" className={cn(primaryButtonClass)}>
            <LayoutGrid size={14} strokeWidth={1.75} aria-hidden />
            Track an application
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
          <Link href="/openings" className={cn(outlineButtonClass)}>
            <Radio size={14} strokeWidth={1.75} aria-hidden />
            Browse openings
          </Link>
        </div>
      </div>
    </div>
  );
}
