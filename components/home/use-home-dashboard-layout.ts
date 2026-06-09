"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  computeHomeDashboardLayout,
  HOME_POSTING_ROW_REM,
  HOME_POSTING_TABLE_HEADER_REM,
  HOME_SIDEBAR_ROW_REM,
  readGapPx,
  remToPx,
  type HomeDashboardRowLayout,
} from "@/lib/home/row-budget";
import { splitHomePostingSlots } from "@/lib/home/posting-slots";

const WIDE_LAYOUT_QUERY = "(min-width: 1024px)";

function fallbackLayout(
  recentTotal: number,
  savedTotal: number,
  hotCompaniesTotal: number,
  alertActivityTotal: number,
): HomeDashboardRowLayout {
  const { freshSlots, savedSlots } = splitHomePostingSlots(12, recentTotal, savedTotal);
  const { freshSlots: hotCompanySlots, savedSlots: alertActivitySlots } = splitHomePostingSlots(
    12,
    hotCompaniesTotal,
    alertActivityTotal,
  );
  return {
    freshSlots,
    savedSlots,
    hotCompanySlots,
    alertActivitySlots,
    recentBodyHeightPx: 0,
    savedBodyHeightPx: 0,
    hotCompanyBodyHeightPx: 0,
    alertActivityBodyHeightPx: 0,
  };
}

function layoutEqual(a: HomeDashboardRowLayout, b: HomeDashboardRowLayout): boolean {
  return (
    a.freshSlots === b.freshSlots &&
    a.savedSlots === b.savedSlots &&
    a.hotCompanySlots === b.hotCompanySlots &&
    a.alertActivitySlots === b.alertActivitySlots &&
    a.recentBodyHeightPx === b.recentBodyHeightPx &&
    a.savedBodyHeightPx === b.savedBodyHeightPx &&
    a.hotCompanyBodyHeightPx === b.hotCompanyBodyHeightPx &&
    a.alertActivityBodyHeightPx === b.alertActivityBodyHeightPx
  );
}

export function useHomeDashboardLayout(
  recentTotal: number,
  savedTotal: number,
  hotCompaniesTotal: number,
  alertActivityTotal: number,
) {
  const gridRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const recentHeaderRef = useRef<HTMLDivElement>(null);
  const savedHeaderRef = useRef<HTMLDivElement>(null);
  const hotHeaderRef = useRef<HTMLDivElement>(null);
  const alertActivityHeaderRef = useRef<HTMLDivElement>(null);
  const postingTableHeaderRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<HomeDashboardRowLayout>(() =>
    fallbackLayout(recentTotal, savedTotal, hotCompaniesTotal, alertActivityTotal),
  );

  const recalculate = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const isWide = window.matchMedia(WIDE_LAYOUT_QUERY).matches;
    if (!isWide) {
      setLayout((current) => {
        const next = fallbackLayout(
          recentTotal,
          savedTotal,
          hotCompaniesTotal,
          alertActivityTotal,
        );
        return layoutEqual(current, next) ? current : next;
      });
      return;
    }

    const columnHeightPx = grid.clientHeight;
    if (columnHeightPx <= 0) return;

    const rootFontSizePx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const postingTableHeaderPx =
      postingTableHeaderRef.current?.offsetHeight ??
      remToPx(HOME_POSTING_TABLE_HEADER_REM, rootFontSizePx);
    const postingRowPx =
      postingTableHeaderRef.current?.offsetHeight ?? remToPx(HOME_POSTING_ROW_REM, rootFontSizePx);
    const sidebarRowPx = remToPx(HOME_SIDEBAR_ROW_REM, rootFontSizePx);
    const columnGapPx = readGapPx(leftColumnRef.current ?? rightColumnRef.current);

    const recentHeaderPx = recentHeaderRef.current?.offsetHeight ?? 0;
    const savedHeaderPx =
      savedTotal > 0 ? (savedHeaderRef.current?.offsetHeight ?? recentHeaderPx) : 0;
    const hotHeaderPx = hotHeaderRef.current?.offsetHeight ?? 0;
    const alertActivityHeaderPx =
      alertActivityTotal > 0
        ? (alertActivityHeaderRef.current?.offsetHeight ?? hotHeaderPx)
        : 0;

    const next = computeHomeDashboardLayout({
      columnHeightPx,
      columnGapPx,
      recentHeaderPx,
      savedHeaderPx,
      hotHeaderPx,
      alertActivityHeaderPx,
      postingRowPx,
      postingTableHeaderPx,
      sidebarRowPx,
      recentAvailable: recentTotal,
      savedAvailable: savedTotal,
      hotCompaniesAvailable: hotCompaniesTotal,
      alertActivityAvailable: alertActivityTotal,
    });

    setLayout((current) => (layoutEqual(current, next) ? current : next));
  }, [alertActivityTotal, hotCompaniesTotal, recentTotal, savedTotal]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(recalculate);

    const grid = gridRef.current;
    if (!grid) return () => cancelAnimationFrame(frame);

    const observer = new ResizeObserver(recalculate);
    observer.observe(grid);

    for (const node of [
      leftColumnRef.current,
      rightColumnRef.current,
      recentHeaderRef.current,
      savedHeaderRef.current,
      hotHeaderRef.current,
      alertActivityHeaderRef.current,
      postingTableHeaderRef.current,
    ]) {
      if (node) observer.observe(node);
    }

    window.addEventListener("resize", recalculate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", recalculate);
    };
  }, [recalculate]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(recalculate);
    return () => cancelAnimationFrame(frame);
  }, [
    layout.freshSlots,
    layout.savedSlots,
    layout.hotCompanySlots,
    layout.alertActivitySlots,
    recalculate,
  ]);

  return {
    freshSlotCount: layout.freshSlots,
    savedSlotCount: layout.savedSlots,
    hotCompanySlotCount: layout.hotCompanySlots,
    alertActivitySlotCount: layout.alertActivitySlots,
    recentBodyHeightPx: layout.recentBodyHeightPx,
    savedBodyHeightPx: layout.savedBodyHeightPx,
    hotCompanyBodyHeightPx: layout.hotCompanyBodyHeightPx,
    alertActivityBodyHeightPx: layout.alertActivityBodyHeightPx,
    gridRef,
    leftColumnRef,
    rightColumnRef,
    recentHeaderRef,
    savedHeaderRef,
    hotHeaderRef,
    alertActivityHeaderRef,
    postingTableHeaderRef,
  };
}
