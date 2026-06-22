"use client";

import { Star } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { MotionStaggerItem } from "@/components/design-system/motion-stagger";
import {
  formatOpeningCount,
  getCompanyHealth,
} from "@/components/companies/company-card";
import { IndustryIcon } from "@/components/stats/industry-icon";
import type { DiscoverCompanyCard } from "@/lib/discover/types";
import { cn } from "@/lib/utils";

export const COMPANY_ROW_DESKTOP_GRID =
  "grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.65fr)_minmax(0,0.75fr)] items-stretch";

export const COMPANY_ROW_HEADER_CELL =
  "border-r border-border/70 px-4 py-0 last:border-r-0";

export const COMPANY_ROW_BODY_CELL =
  "min-w-0 border-r border-border/50 px-4 py-0 last:border-r-0";

function CompanyStarButton({
  companyName,
  starred,
  starPending,
  onToggleStar,
  className,
}: {
  companyName: string;
  starred: boolean;
  starPending?: boolean;
  onToggleStar: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleStar();
      }}
      disabled={starPending}
      aria-label={starred ? `Unstar ${companyName}` : `Star ${companyName}`}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-all hover:bg-muted/50 hover:text-foreground disabled:opacity-50",
        starred ? "text-amber-700 opacity-100" : "opacity-0 group-hover:opacity-100",
        className,
      )}
    >
      <Star
        size={14}
        strokeWidth={1.75}
        fill={starred ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}

export function CompanyRow({
  company,
  selected,
  starred,
  starPending,
  lazyLogo,
  onOpen,
  onToggleStar,
  layout = "desktop",
  index = 0,
}: {
  company: DiscoverCompanyCard;
  index?: number;
  selected: boolean;
  starred: boolean;
  starPending?: boolean;
  lazyLogo?: boolean;
  onOpen: () => void;
  onToggleStar: () => void;
  layout?: "desktop" | "mobile";
}) {
  const isHiring = company.openCount > 0;
  const health = getCompanyHealth(company);
  const updatedLabel =
    health.kind === "ok" ? health.label.replace(/^about /i, "") : health.label;

  if (layout === "mobile") {
    return (
      <MotionStaggerItem as="li" index={index}>
        <div
          className={cn(
            "group flex items-center gap-3 border-b border-border px-4 py-3 transition-colors",
            selected && "bg-muted/35",
          )}
        >
          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label={`${company.name} on Companies`}
            aria-current={selected ? "true" : undefined}
          >
            <CompanyLogo
              company={company.name}
              companySlug={company.slug}
              logoAssetKey={company.logoAssetKey}
              websiteUrl={company.websiteUrl}
              size={36}
              lazy={lazyLogo}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <IndustryIcon slug={company.industry} className="!size-4" />
                <span className="truncate">{company.industryLabel}</span>
                <span className="text-border">·</span>
                <span className="tabular-nums">{formatOpeningCount(company.openCount)}</span>
              </p>
            </div>
          </button>
          <CompanyStarButton
            companyName={company.name}
            starred={starred}
            starPending={starPending}
            onToggleStar={onToggleStar}
            className={
              starred ? undefined : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
            }
          />
        </div>
      </MotionStaggerItem>
    );
  }

  return (
    <MotionStaggerItem as="li" index={index}>
      <div
        className={cn(
          "group relative border-b border-border transition-colors hover:bg-muted/20",
          selected && "bg-muted/35",
        )}
      >
        <div className={cn(COMPANY_ROW_DESKTOP_GRID, "min-h-[2.25rem]")}>
          <div className={COMPANY_ROW_BODY_CELL}>
            <div className="flex h-full min-h-[2.25rem] items-center gap-1 py-1.5 pr-1">
              <button
                type="button"
                onClick={onOpen}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                aria-label={`${company.name} on Companies`}
                aria-current={selected ? "true" : undefined}
              >
                <CompanyLogo
                  company={company.name}
                  companySlug={company.slug}
                  logoAssetKey={company.logoAssetKey}
                  websiteUrl={company.websiteUrl}
                  size={24}
                  lazy={lazyLogo}
                />
                <span className="truncate text-sm font-medium text-foreground">{company.name}</span>
              </button>
              <CompanyStarButton
                companyName={company.name}
                starred={starred}
                starPending={starPending}
                onToggleStar={onToggleStar}
              />
            </div>
          </div>

          <div className={cn(COMPANY_ROW_BODY_CELL, "flex items-center py-1.5")}>
            <span className="flex min-w-0 items-center gap-2 truncate text-sm text-muted-foreground">
              <IndustryIcon slug={company.industry} />
              <span className="truncate">{company.industryLabel}</span>
            </span>
          </div>

          <div className={cn(COMPANY_ROW_BODY_CELL, "flex items-center py-1.5")}>
            <span
              className={cn(
                "text-sm tabular-nums",
                isHiring ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {formatOpeningCount(company.openCount)}
            </span>
          </div>

          <div className={cn(COMPANY_ROW_BODY_CELL, "flex items-center py-1.5")}>
            <span className="truncate text-sm text-muted-foreground">{updatedLabel}</span>
          </div>
        </div>
      </div>
    </MotionStaggerItem>
  );
}
