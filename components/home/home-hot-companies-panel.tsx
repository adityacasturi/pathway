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
import type { HotCompany } from "@/lib/home/briefing";
import { homeSidebarListBodyLayout } from "@/lib/home/list-body-layout";
import { cn } from "@/lib/utils";

export function HomeHotCompaniesPanel({
  companies,
  slotCount,
  splitBelow = false,
  headerRef,
  bodyHeightPx,
  isWideLayout,
}: {
  companies: HotCompany[];
  slotCount: number;
  splitBelow?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
  isWideLayout: boolean;
}) {
  const { style, paddingRows } = homeSidebarListBodyLayout(
    isWideLayout,
    slotCount,
    companies.length,
    bodyHeightPx,
  );

  return (
    <section className={cn(HOME_SECTION, splitBelow && HOME_SECTION_SPLIT_BELOW)}>
      <div ref={headerRef} className={HOME_SECTION_HEADER}>
        <HomeSectionHeader
          title="Hot companies"
          actions={<HomeHeaderArrowLink href="/companies" label="Browse companies" />}
          className="mb-0"
        />
      </div>

      {slotCount === 0 ? (
        <p className="px-5 py-3 text-[13px] text-muted-foreground">No hiring surge this week yet.</p>
      ) : (
        <MotionStaggerList
          as="ul"
          className={cn("w-full min-w-0 max-lg:overflow-x-hidden", isWideLayout && "grid overflow-hidden")}
          style={style}
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
                  "flex h-full min-h-0 w-full min-w-0 items-center gap-3 overflow-hidden px-4 py-2.5 max-lg:overflow-x-hidden lg:px-5",
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
