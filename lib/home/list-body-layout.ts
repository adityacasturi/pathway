import type { CSSProperties } from "react";
import { HOME_POSTING_ROW_HEIGHT } from "@/components/home/home-postings-table";
import { HOME_SIDEBAR_ROW_REM } from "@/lib/home/row-budget";

const SIDEBAR_ROW_HEIGHT = `${HOME_SIDEBAR_ROW_REM}rem`;

export function homeListBodyLayout({
  isWideLayout,
  slotCount,
  itemCount,
  bodyHeightPx,
  rowHeight = HOME_POSTING_ROW_HEIGHT,
}: {
  isWideLayout: boolean;
  slotCount: number;
  itemCount: number;
  bodyHeightPx?: number;
  rowHeight?: string;
}) {
  if (!isWideLayout) {
    return {
      style: undefined as CSSProperties | undefined,
      paddingRows: 0,
      flexRows: false,
    };
  }

  const paddingRows = Math.max(0, slotCount - itemCount);
  const flexRows = Boolean(bodyHeightPx && bodyHeightPx > 0);
  const bodyHeight =
    bodyHeightPx && bodyHeightPx > 0
      ? `${bodyHeightPx}px`
      : `calc(${slotCount} * ${rowHeight})`;

  return {
    style: {
      height: bodyHeight,
      gridTemplateRows: flexRows
        ? `repeat(${slotCount}, minmax(0, 1fr))`
        : `repeat(${slotCount}, ${rowHeight})`,
    } as CSSProperties,
    paddingRows,
    flexRows,
  };
}

export function homeSidebarListBodyLayout(
  isWideLayout: boolean,
  slotCount: number,
  itemCount: number,
  bodyHeightPx?: number,
) {
  return homeListBodyLayout({
    isWideLayout,
    slotCount,
    itemCount,
    bodyHeightPx,
    rowHeight: SIDEBAR_ROW_HEIGHT,
  });
}
