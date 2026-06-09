import type { ReactNode } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/utils";

export interface SectorLogoCompany {
  slug: string;
  name: string;
  websiteUrl: string | null;
}

/** Fixed icon column width for alert follows and bundle rows. */
export const ALERT_FOLLOW_LOGO_SLOT = 36;

const GRID_GAP = 2;

/** Logo size inside a bundle grid cell. */
export const ALERT_FOLLOW_BUNDLE_CELL_SIZE = Math.floor((ALERT_FOLLOW_LOGO_SLOT - GRID_GAP) / 2);

/** Single-company logos fill the same slot as a quad bundle preview. */
export const ALERT_FOLLOW_SINGLE_LOGO_SIZE = ALERT_FOLLOW_LOGO_SLOT;

interface Props {
  companies: SectorLogoCompany[];
  slotSize?: number;
  className?: string;
}

function BundleLogo({
  company,
  size,
}: {
  company: SectorLogoCompany;
  size: number;
}) {
  return (
    <CompanyLogo
      company={company.name}
      companySlug={company.slug}
      websiteUrl={company.websiteUrl}
      size={size}
    />
  );
}

export function AlertFollowLogoSlot({
  children,
  slotSize = ALERT_FOLLOW_LOGO_SLOT,
  className,
}: {
  children: ReactNode;
  slotSize?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center", className)}
      style={{ width: slotSize, height: slotSize }}
    >
      {children}
    </div>
  );
}

/** Compact bundle logo preview in a fixed square slot — grid for 3+, pair for 2, single for 1. */
export function SectorLogoStack({
  companies,
  slotSize = ALERT_FOLLOW_LOGO_SLOT,
  className,
}: Props) {
  if (companies.length === 0) {
    return null;
  }

  const displayed = companies.slice(0, 4);
  const count = displayed.length;
  const cellSize = Math.floor((slotSize - GRID_GAP) / 2);

  const slot = (content: ReactNode) => (
    <div
      className={cn("flex shrink-0 items-center justify-center", className)}
      style={{ width: slotSize, height: slotSize }}
      aria-hidden
    >
      {content}
    </div>
  );

  if (count === 1) {
    return slot(<BundleLogo company={displayed[0]} size={slotSize} />);
  }

  if (count === 2) {
    return slot(
      <div className="flex items-center justify-center gap-0.5">
        {displayed.map((company) => (
          <BundleLogo key={company.slug} company={company} size={cellSize} />
        ))}
      </div>,
    );
  }

  return slot(
    <div
      className="grid grid-cols-2"
      style={{ width: slotSize, height: slotSize, gap: GRID_GAP }}
    >
      {displayed.map((company) => (
        <BundleLogo key={company.slug} company={company} size={cellSize} />
      ))}
    </div>,
  );
}
