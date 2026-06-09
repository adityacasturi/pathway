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
  homeAlertActivityDescription,
  homeAlertActivitySummary,
  type HomeAlertActivityRow,
} from "@/lib/home/alert-activity";
import { HOME_SIDEBAR_ROW_REM } from "@/lib/home/row-budget";
import { cn } from "@/lib/utils";

const SIDEBAR_ROW_HEIGHT = `${HOME_SIDEBAR_ROW_REM}rem`;

function alertActivityBodyHeight(slotCount: number): string {
  return `calc(${slotCount} * ${SIDEBAR_ROW_HEIGHT})`;
}

export function HomeAlertActivityPanel({
  rows,
  allRows,
  slotCount,
  splitAbove = false,
  headerRef,
  bodyHeightPx,
}: {
  rows: HomeAlertActivityRow[];
  allRows: HomeAlertActivityRow[];
  slotCount: number;
  splitAbove?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
}) {
  const alertSummary = homeAlertActivitySummary(allRows);
  const paddingRows = Math.max(0, slotCount - rows.length);
  const bodyHeight =
    bodyHeightPx && bodyHeightPx > 0 ? `${bodyHeightPx}px` : alertActivityBodyHeight(slotCount);
  const flexRows = Boolean(bodyHeightPx && bodyHeightPx > 0);

  if (rows.length === 0 && slotCount === 0) return null;

  return (
    <section className={cn(HOME_SECTION, splitAbove && HOME_SECTION_SPLIT_ABOVE)}>
      <div ref={headerRef} className={HOME_SECTION_HEADER}>
        <HomeSectionHeader
          title="Your alerts"
          description={homeAlertActivityDescription(alertSummary)}
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
          className="grid overflow-hidden"
          style={{
            height: bodyHeight,
            gridTemplateRows: flexRows
              ? `repeat(${slotCount}, minmax(0, 1fr))`
              : `repeat(${slotCount}, ${SIDEBAR_ROW_HEIGHT})`,
          }}
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
                  "flex h-full min-h-0 items-center gap-3 px-5 py-2.5",
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
