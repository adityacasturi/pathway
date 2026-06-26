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
  HOME_SECTION_SPLIT_ABOVE,
} from "@/components/home/home-section-styles";
import {
  alertCountLabel,
  type HomeAlertActivityRow,
} from "@/lib/home/alert-activity";
import { homeSidebarListBodyLayout } from "@/lib/home/list-body-layout";
import { cn } from "@/lib/utils";

export function HomeAlertActivityPanel({
  rows,
  slotCount,
  splitAbove = false,
  headerRef,
  bodyHeightPx,
  isWideLayout,
}: {
  rows: HomeAlertActivityRow[];
  slotCount: number;
  splitAbove?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
  isWideLayout: boolean;
}) {
  const { style, paddingRows } = homeSidebarListBodyLayout(
    isWideLayout,
    slotCount,
    rows.length,
    bodyHeightPx,
  );

  if (rows.length === 0 && slotCount === 0) return null;

  return (
    <section className={cn(HOME_SECTION, splitAbove && HOME_SECTION_SPLIT_ABOVE)}>
      <div ref={headerRef} className={HOME_SECTION_HEADER}>
        <HomeSectionHeader
          title="Your alerts"
          actions={<HomeHeaderArrowLink href="/alerts" label="Manage alerts" />}
          className="mb-0"
        />
      </div>

      {slotCount === 0 ? (
        <p className="px-5 py-3 text-[13px] text-muted-foreground">
          Follow companies on Alerts to see activity here.
        </p>
      ) : (
        <MotionStaggerList
          as="ul"
          className={cn("w-full min-w-0 max-lg:overflow-x-hidden", isWideLayout && "grid overflow-hidden")}
          style={style}
        >
          {rows.map((row, index) => (
            <MotionStaggerItem
              as="li"
              key={row.companyId}
              index={index}
              className={cn("min-h-0 overflow-hidden", HOME_ROW_BORDER)}
            >
              <Link
                href="/alerts"
                className={cn(
                  "flex h-full min-h-0 w-full min-w-0 items-center gap-3 overflow-hidden px-4 py-2.5 max-lg:overflow-x-hidden lg:px-5",
                  HOME_ROW_HOVER,
                )}
              >
                <CompanyLogo
                  company={row.name}
                  companySlug={row.slug}
                  websiteUrl={row.websiteUrl}
                  size={28}
                  lazy
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{row.name}</p>
                  <p
                    className={cn(
                      "text-[12px]",
                      row.alertCount > 0 ? "text-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {row.alertCount > 0
                      ? alertCountLabel(row.alertCount)
                      : "Watching — no alerts this week yet"}
                  </p>
                </div>
              </Link>
            </MotionStaggerItem>
          ))}
          {Array.from({ length: paddingRows }, (_, index) => (
            <li
              key={`alert-pad-${index}`}
              aria-hidden
              className={cn("overflow-hidden", HOME_ROW_BORDER)}
            />
          ))}
        </MotionStaggerList>
      )}
    </section>
  );
}
