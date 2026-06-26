import { splitHomePostingSlots } from "@/lib/home/posting-slots";

export const HOME_POSTING_ROW_REM = 2.25;
export const HOME_POSTING_TABLE_HEADER_REM = 2.25;
export const HOME_SIDEBAR_ROW_REM = 3;
/** Fallback when column gap cannot be measured yet (split layout uses 0). */
export const HOME_COLUMN_GAP_PX = 0;
/** Hairline between stacked sections in the same column. */
export const HOME_SECTION_SPLIT_PX = 1;

/** Largest row count that fits in `areaPx` at `rowPx` per row. */
export function maxRowSlots(areaPx: number, rowPx: number): number {
  if (areaPx <= 0 || rowPx <= 0) return 0;
  return Math.floor(areaPx / rowPx);
}

export function remToPx(rem: number, rootFontSizePx: number): number {
  return rem * rootFontSizePx;
}

export function readGapPx(element: HTMLElement | null, fallbackPx = HOME_COLUMN_GAP_PX): number {
  if (!element) return fallbackPx;
  const gap = getComputedStyle(element).rowGap || getComputedStyle(element).gap;
  const parsed = Number.parseFloat(gap);
  return Number.isFinite(parsed) ? parsed : fallbackPx;
}

export type HomeDashboardRowLayout = {
  freshSlots: number;
  savedSlots: number;
  hotCompanySlots: number;
  alertActivitySlots: number;
  recentBodyHeightPx: number;
  savedBodyHeightPx: number;
  hotCompanyBodyHeightPx: number;
  alertActivityBodyHeightPx: number;
};

function splitStackedBodyHeights(
  topSlots: number,
  bottomSlots: number,
  rowPx: number,
  rowAreaPx: number,
): { topBodyHeightPx: number; bottomBodyHeightPx: number } {
  const bodyPx = (topSlots + bottomSlots) * rowPx;
  const remainderPx = Math.max(0, rowAreaPx - bodyPx);
  const totalSlots = topSlots + bottomSlots;
  const topShare =
    totalSlots > 0 && bottomSlots > 0
      ? Math.round(remainderPx * (topSlots / totalSlots))
      : remainderPx;

  return {
    topBodyHeightPx: topSlots * rowPx + (topSlots > 0 ? topShare : 0),
    bottomBodyHeightPx: bottomSlots * rowPx + (bottomSlots > 0 ? remainderPx - topShare : 0),
  };
}

function computeStackedColumnSlots(input: {
  columnHeightPx: number;
  columnGapPx: number;
  topHeaderPx: number;
  bottomHeaderPx: number;
  topTableHeaderPx: number;
  bottomTableHeaderPx: number;
  rowPx: number;
  topAvailable: number;
  bottomAvailable: number;
}): {
  topSlots: number;
  bottomSlots: number;
  topBodyHeightPx: number;
  bottomBodyHeightPx: number;
} {
  const bottomVisible = input.bottomAvailable > 0;
  const fixedChromePx =
    input.topHeaderPx +
    input.topTableHeaderPx +
    (bottomVisible
      ? input.columnGapPx + HOME_SECTION_SPLIT_PX + input.bottomHeaderPx + input.bottomTableHeaderPx
      : 0);

  const rowAreaPx = Math.max(0, input.columnHeightPx - fixedChromePx);
  const totalSlots = maxRowSlots(rowAreaPx, input.rowPx);

  let topSlots = 0;
  let bottomSlots = 0;

  if (input.topAvailable <= 0 && input.bottomAvailable <= 0) {
    topSlots = 0;
    bottomSlots = 0;
  } else if (!bottomVisible) {
    topSlots = input.topAvailable > 0 ? totalSlots : 0;
  } else if (input.topAvailable <= 0) {
    bottomSlots = totalSlots;
  } else {
    ({ freshSlots: topSlots, savedSlots: bottomSlots } = splitHomePostingSlots(
      totalSlots,
      input.topAvailable,
      input.bottomAvailable,
    ));
  }

  const { topBodyHeightPx, bottomBodyHeightPx } = splitStackedBodyHeights(
    topSlots,
    bottomSlots,
    input.rowPx,
    rowAreaPx,
  );

  return { topSlots, bottomSlots, topBodyHeightPx, bottomBodyHeightPx };
}

export function computeHomeDashboardLayout(input: {
  columnHeightPx: number;
  columnGapPx: number;
  recentHeaderPx: number;
  savedHeaderPx: number;
  hotHeaderPx: number;
  alertActivityHeaderPx: number;
  postingRowPx: number;
  postingTableHeaderPx: number;
  sidebarRowPx: number;
  recentAvailable: number;
  savedAvailable: number;
  hotCompaniesAvailable: number;
  alertActivityAvailable: number;
}): HomeDashboardRowLayout {
  const postings = computeStackedColumnSlots({
    columnHeightPx: input.columnHeightPx,
    columnGapPx: input.columnGapPx,
    topHeaderPx: input.recentHeaderPx,
    bottomHeaderPx: input.savedHeaderPx,
    topTableHeaderPx: input.postingTableHeaderPx,
    bottomTableHeaderPx: input.postingTableHeaderPx,
    rowPx: input.postingRowPx,
    topAvailable: input.recentAvailable,
    bottomAvailable: input.savedAvailable,
  });

  const sidebar = computeStackedColumnSlots({
    columnHeightPx: input.columnHeightPx,
    columnGapPx: input.columnGapPx,
    topHeaderPx: input.hotHeaderPx,
    bottomHeaderPx: input.alertActivityHeaderPx,
    topTableHeaderPx: 0,
    bottomTableHeaderPx: 0,
    rowPx: input.sidebarRowPx,
    topAvailable: input.hotCompaniesAvailable,
    bottomAvailable: input.alertActivityAvailable,
  });

  return {
    freshSlots: postings.topSlots,
    savedSlots: postings.bottomSlots,
    hotCompanySlots: sidebar.topSlots,
    alertActivitySlots: sidebar.bottomSlots,
    recentBodyHeightPx: postings.topBodyHeightPx,
    savedBodyHeightPx: postings.bottomBodyHeightPx,
    hotCompanyBodyHeightPx: sidebar.topBodyHeightPx,
    alertActivityBodyHeightPx: sidebar.bottomBodyHeightPx,
  };
}
