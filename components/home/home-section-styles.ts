/**
 * Home surface hierarchy — matches Openings / Applications list pages.
 *
 * Canvas (app shell) → bg-background (paper)
 * Main panel          → bg-card (white)
 * Pipeline rail       → bg-muted/20 (subtle top anchor)
 * Section headers     → bg-card + border (toolbar-like, no fill band)
 * Column headers      → bg-muted/25
 * Rows                → bg-card, hover bg-muted/30
 */

export const HOME_SECTION =
  "flex flex-col bg-card max-lg:min-w-0 max-lg:overflow-x-hidden lg:min-h-0 lg:overflow-hidden";

export const HOME_SECTION_SPLIT_BELOW = "[&_ul>li:last-child]:border-b-0";

export const HOME_SECTION_SPLIT_ABOVE = "border-t border-border";

export const HOME_PIPELINE_RAIL =
  "shrink-0 border-b border-border bg-muted/20 max-lg:overflow-x-hidden";

export const HOME_SECTION_HEADER =
  "shrink-0 border-b border-border bg-card px-4 py-1.5 lg:px-5";

export const HOME_TABLE_COL_HEADER =
  "h-[2.25rem] shrink-0 overflow-hidden border-b border-border bg-muted/25";

export const HOME_ROW_HOVER = "transition-colors hover:bg-muted/30";

export const HOME_ROW_BORDER = "border-b border-border/60";
