"use client";

import { CompanyLogo } from "@/components/company-logo";
import { formatOpeningCount } from "@/components/companies/company-card";
import type { DiscoverCompanyCard } from "@/lib/discover/types";
import { UI_COUNT_BADGE } from "@/lib/ui/selection-styles";
import { cn } from "@/lib/utils";

const LOGO_SIZE = 40;

export function StarredCompaniesStrip({
  companies,
  selectedSlug,
  onSelect,
  className,
}: {
  companies: DiscoverCompanyCard[];
  selectedSlug: string | null;
  onSelect: (company: DiscoverCompanyCard) => void;
  className?: string;
}) {
  if (companies.length === 0) return null;

  return (
    <section
      className={cn(
        "flex shrink-0 items-stretch border-b border-border bg-card",
        className,
      )}
      aria-label="Starred companies"
    >
      <div className="flex shrink-0 items-center gap-2 border-r border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">Starred</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {companies.length}
        </span>
      </div>

      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {companies.map((company) => {
          const active = selectedSlug === company.slug;
          const showCount = company.openCount > 0;

          return (
            <button
              key={company.id}
              type="button"
              onClick={() => onSelect(company)}
              aria-pressed={active}
              aria-label={company.name}
              title={`${company.name} · ${formatOpeningCount(company.openCount)}`}
              className={cn(
                "relative flex shrink-0 items-center rounded-full p-1 transition-colors",
                active ? "bg-muted/60" : "hover:bg-muted/35",
              )}
            >
              <span
                className={cn(
                  "relative inline-flex shrink-0 rounded-full",
                  active &&
                    "ring-2 ring-[color-mix(in_oklab,var(--primary)_35%,var(--border))] ring-offset-2 ring-offset-card",
                )}
              >
                <CompanyLogo
                  company={company.name}
                  companySlug={company.slug}
                  logoAssetKey={company.logoAssetKey}
                  websiteUrl={company.websiteUrl}
                  size={LOGO_SIZE}
                  lazy
                />
                {showCount ? (
                  <span
                    className={cn(
                      UI_COUNT_BADGE,
                      "absolute bottom-0 right-0 min-w-[1.25rem] translate-x-1/4 translate-y-1/4 px-1 py-1 text-[10px] leading-none tabular-nums",
                    )}
                    aria-hidden
                  >
                    {company.openCount > 99 ? "99+" : company.openCount}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
