"use client";

import type { Ref } from "react";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import { HomeHeaderArrowLink } from "@/components/home/home-header-arrow-link";
import {
  HOME_SECTION,
  HOME_SECTION_HEADER,
  HOME_SECTION_SPLIT_ABOVE,
  HOME_SECTION_SPLIT_BELOW,
  HOME_TABLE_COL_HEADER,
} from "@/components/home/home-section-styles";
import {
  HOME_POSTINGS_GRID,
  HOME_POSTINGS_TABLE_HEADERS,
  HOME_POSTING_ROW_HEIGHT,
  homePostingsTableBodyHeight,
  HomeEmptyPostingRow,
  HomePostingRow,
  HomeTableHeaderCell,
} from "@/components/home/home-postings-table";
import type { FeedPosting } from "@/lib/feed/source";
import { cn } from "@/lib/utils";

function PostingsTableHeader({ headerRef }: { headerRef?: Ref<HTMLDivElement> }) {
  return (
    <div ref={headerRef} className={cn(HOME_POSTINGS_GRID, HOME_TABLE_COL_HEADER)}>
      {HOME_POSTINGS_TABLE_HEADERS.map((label) => (
        <HomeTableHeaderCell key={label} label={label} />
      ))}
    </div>
  );
}

function PostingsTableBody({
  postings,
  slotCount,
  idPrefix,
  tableHeaderRef,
  bodyHeightPx,
}: {
  postings: FeedPosting[];
  slotCount: number;
  idPrefix: string;
  tableHeaderRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
}) {
  const paddingRows = slotCount - postings.length;
  const bodyHeight =
    bodyHeightPx && bodyHeightPx > 0
      ? `${bodyHeightPx}px`
      : homePostingsTableBodyHeight(slotCount);
  const flexRows = Boolean(bodyHeightPx && bodyHeightPx > 0);

  return (
    <div className="overflow-hidden">
      <PostingsTableHeader headerRef={tableHeaderRef} />
      <ul
        className="grid overflow-hidden"
        style={{
          height: bodyHeight,
          gridTemplateRows: flexRows
            ? `repeat(${slotCount}, minmax(0, 1fr))`
            : `repeat(${slotCount}, ${HOME_POSTING_ROW_HEIGHT})`,
        }}
      >
        {postings.map((posting) => (
          <HomePostingRow key={posting.id} posting={posting} flexHeight={flexRows} />
        ))}
        {Array.from({ length: paddingRows }, (_, index) => (
          <HomeEmptyPostingRow key={`${idPrefix}-pad-${index}`} flexHeight={flexRows} />
        ))}
      </ul>
    </div>
  );
}

export function HomeRecentPostingsPanel({
  postings,
  slotCount,
  recentTotal,
  splitBelow = false,
  headerRef,
  tableHeaderRef,
  bodyHeightPx,
}: {
  postings: FeedPosting[];
  slotCount: number;
  recentTotal: number;
  splitBelow?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  tableHeaderRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
}) {
  if (slotCount === 0 && recentTotal === 0) {
    return (
      <section className={cn(HOME_SECTION, splitBelow && HOME_SECTION_SPLIT_BELOW)}>
        <div className={HOME_SECTION_HEADER}>
          <HomeSectionHeader title="Recent" description="No roles in the catalog yet." className="mb-0" />
        </div>
      </section>
    );
  }

  if (slotCount === 0) return null;

  return (
    <section className={cn(HOME_SECTION, splitBelow && HOME_SECTION_SPLIT_BELOW)}>
      <div ref={headerRef} className={HOME_SECTION_HEADER}>
        <HomeSectionHeader
          title="Recent"
          description={`${recentTotal.toLocaleString()} roles across the catalog.`}
          actions={<HomeHeaderArrowLink href="/openings" label="View openings" />}
          className="mb-0"
        />
      </div>
      <PostingsTableBody
        postings={postings}
        slotCount={slotCount}
        idPrefix="recent"
        tableHeaderRef={tableHeaderRef}
        bodyHeightPx={bodyHeightPx}
      />
    </section>
  );
}

export function HomeSavedPostingsPanel({
  postings,
  slotCount,
  savedTotal,
  splitAbove = false,
  headerRef,
  bodyHeightPx,
}: {
  postings: FeedPosting[];
  slotCount: number;
  savedTotal: number;
  splitAbove?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
}) {
  if (savedTotal === 0) return null;

  if (slotCount === 0) return null;

  return (
    <section className={cn(HOME_SECTION, splitAbove && HOME_SECTION_SPLIT_ABOVE)}>
      <div ref={headerRef} className={HOME_SECTION_HEADER}>
        <HomeSectionHeader
          title="Saved for later"
          description={`${savedTotal.toLocaleString()} roles`}
          actions={<HomeHeaderArrowLink href="/openings" label="View saved roles" />}
          className="mb-0"
        />
      </div>
      <PostingsTableBody
        postings={postings}
        slotCount={slotCount}
        idPrefix="saved"
        bodyHeightPx={bodyHeightPx}
      />
    </section>
  );
}
