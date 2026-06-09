"use client";

import Link from "next/link";
import type { Ref } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { MotionStaggerItem, MotionStaggerList } from "@/components/design-system/motion-stagger";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import { HomeHeaderArrowLink } from "@/components/home/home-header-arrow-link";
import {
  HOME_ROW_BORDER,
  HOME_ROW_HOVER,
  HOME_SECTION,
  HOME_SECTION_HEADER,
  HOME_SECTION_SPLIT_BELOW,
} from "@/components/home/home-section-styles";
import { HOME_SIDEBAR_ROW_REM } from "@/lib/home/row-budget";
import type { HotCompany } from "@/lib/home/briefing";
import { cn } from "@/lib/utils";

const HOT_COMPANY_ROW_HEIGHT = `${HOME_SIDEBAR_ROW_REM}rem`;

function hotCompaniesBodyHeight(slotCount: number): string {
  return `calc(${slotCount} * ${HOT_COMPANY_ROW_HEIGHT})`;
}

export function HomeHotCompaniesPanel({
  companies,
  slotCount,
  splitBelow = false,
  headerRef,
  bodyHeightPx,
}: {
  companies: HotCompany[];
  slotCount: number;
  splitBelow?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
}) {
  const paddingRows = Math.max(0, slotCount - companies.length);
  const bodyHeight =
    bodyHeightPx && bodyHeightPx > 0
      ? `${bodyHeightPx}px`
      : hotCompaniesBodyHeight(slotCount);
  const flexRows = Boolean(bodyHeightPx && bodyHeightPx > 0);

  return (
    <section className={cn(HOME_SECTION, splitBelow && HOME_SECTION_SPLIT_BELOW)}>
      <div ref={headerRef} className={HOME_SECTION_HEADER}>
        <HomeSectionHeader
          title="Hot companies"
          description="Most new roles posted in the last 7 days."
          actions={<HomeHeaderArrowLink href="/companies" label="Browse companies" />}
          className="mb-0"
        />
      </div>

      {slotCount === 0 ? (
        <p className="px-5 py-3 text-[13px] text-muted-foreground">No hiring surge this week yet.</p>
      ) : (
        <MotionStaggerList
          as="ul"
          className="grid overflow-hidden"
          style={{
            height: bodyHeight,
            gridTemplateRows: flexRows
              ? `repeat(${slotCount}, minmax(0, 1fr))`
              : `repeat(${slotCount}, ${HOT_COMPANY_ROW_HEIGHT})`,
          }}
        >
          {companies.map((company, index) => (
            <MotionStaggerItem
              as="li"
              key={company.slug}
              index={index}
              className={cn("min-h-0 overflow-hidden", HOME_ROW_BORDER)}
            >
              <Link
                href={`/companies?company=${encodeURIComponent(company.slug)}`}
                className={cn(
                  "flex h-full min-h-0 items-center gap-3 px-5 py-2.5",
                  HOME_ROW_HOVER,
                )}
              >
                <CompanyLogo
                  company={company.name}
                  companySlug={company.slug}
                  websiteUrl={company.websiteUrl}
                  size={28}
                  lazy
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{company.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {company.newCount.toLocaleString()} new this week
                  </p>
                </div>
              </Link>
            </MotionStaggerItem>
          ))}
          {Array.from({ length: paddingRows }, (_, index) => (
            <li
              key={`hot-pad-${index}`}
              aria-hidden
              className={cn("overflow-hidden", HOME_ROW_BORDER)}
            />
          ))}
        </MotionStaggerList>
      )}
    </section>
  );
}
