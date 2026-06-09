"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import type { CuratedSectorView } from "@/components/alerts/types";
import { CompanyLogo } from "@/components/company-logo";
import { SectorLogoStack } from "@/components/sector-logo-stack";
import { formatBundleCompanyLine } from "@/lib/alerts/bundle-preview";
import { UI_SELECTED } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

export function AlertsBundlesList({
  sectors,
  followedSectorSlugs,
  pendingSectorSlug,
  disabled,
  onToggleSector,
  emptyMessage = "No bundles match your search.",
}: {
  sectors: CuratedSectorView[];
  followedSectorSlugs: Set<string>;
  pendingSectorSlug: string | null;
  disabled: boolean;
  onToggleSector: (slug: string) => void;
  emptyMessage?: string;
}) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  if (sectors.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {sectors.map((sector) => (
        <SectorRow
          key={sector.slug}
          sector={sector}
          active={followedSectorSlugs.has(sector.slug)}
          pending={pendingSectorSlug === sector.slug}
          disabled={disabled}
          expanded={expandedSlug === sector.slug}
          onToggleExpanded={() =>
            setExpandedSlug((current) => (current === sector.slug ? null : sector.slug))
          }
          onToggleFollow={() => onToggleSector(sector.slug)}
        />
      ))}
    </ul>
  );
}

function SectorRow({
  sector,
  active,
  pending,
  disabled,
  expanded,
  onToggleExpanded,
  onToggleFollow,
}: {
  sector: CuratedSectorView;
  active: boolean;
  pending: boolean;
  disabled: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleFollow: () => void;
}) {
  const companyCount = sector.companies.length;
  const companyPreview =
    sector.companies.length > 0
      ? formatBundleCompanyLine(sector.companies)
      : sector.description;

  return (
    <li
      className={cn(
        "overflow-hidden rounded-xl border transition-[border-color,background-color,box-shadow]",
        active
          ? cn(UI_SELECTED, "shadow-[0_0_0_1px_var(--selection-border)]")
          : "border-border bg-card",
      )}
    >
      <div className="flex gap-3 p-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-4 text-left transition-colors hover:opacity-90"
        >
          <SectorLogoStack companies={sector.companies.slice(0, 4)} />
          <span className="min-w-0 flex-1 pl-0.5">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "truncate text-sm",
                  active ? "font-semibold text-[var(--selection-fg)]" : "font-medium text-muted-foreground",
                )}
              >
                {sector.label}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {companyCount}
              </span>
            </span>
            <span
              className="mt-1 block truncate text-[11px] text-muted-foreground"
              title={companyPreview}
            >
              {companyPreview}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5 self-center">
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${sector.label}` : `Expand ${sector.label}`}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              className={cn("transition-transform duration-200", expanded && "rotate-180")}
            />
          </button>
          <button
            type="button"
            disabled={disabled || pending}
            aria-pressed={active}
            aria-label={active ? `Remove alert for ${sector.label}` : `Add alert for ${sector.label}`}
            onClick={onToggleFollow}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : active ? (
              <Check size={14} strokeWidth={2} />
            ) : (
              <Plus size={14} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-border/70 bg-muted/20 px-3 py-2">
          <ul className="space-y-1">
            {sector.companies.map((company) => (
              <li
                key={company.slug}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm text-foreground/90"
              >
                <CompanyLogo
                  company={company.name}
                  companySlug={company.slug}
                  websiteUrl={company.websiteUrl}
                  size={22}
                />
                <span className="min-w-0 truncate">{company.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
