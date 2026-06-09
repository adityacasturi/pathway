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

export const HOME_SECTION = "flex min-h-0 flex-col overflow-hidden bg-card";

export const HOME_SECTION_SPLIT_BELOW = "[&_ul>li:last-child]:border-b-0";

export const HOME_SECTION_SPLIT_ABOVE = "border-t border-border";

export const HOME_PIPELINE_RAIL = "shrink-0 border-b border-border bg-muted/20";

export const HOME_SECTION_HEADER =
  "shrink-0 border-b border-border bg-card px-5 py-3";

export const HOME_TABLE_COL_HEADER =
  "h-[2.75rem] shrink-0 overflow-hidden border-b border-border bg-muted/25";

export const HOME_ROW_HOVER = "transition-colors hover:bg-muted/30";

export const HOME_ROW_BORDER = "border-b border-border/60";
