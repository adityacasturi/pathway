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
  HomeEmptyPostingRow,
  HomePostingRow,
  HomeTableHeaderCell,
} from "@/components/home/home-postings-table";
import { homeListBodyLayout } from "@/lib/home/list-body-layout";
import type { FeedPosting } from "@/lib/feed/source";
import { cn } from "@/lib/utils";

function PostingsTableHeader({
  headerRef,
  isWideLayout,
}: {
  headerRef?: Ref<HTMLDivElement>;
  isWideLayout: boolean;
}) {
  if (!isWideLayout) return null;

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
  isWideLayout,
}: {
  postings: FeedPosting[];
  slotCount: number;
  idPrefix: string;
  tableHeaderRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
  isWideLayout: boolean;
}) {
  const { style, paddingRows, flexRows } = homeListBodyLayout({
    isWideLayout,
    slotCount,
    itemCount: postings.length,
    bodyHeightPx,
  });

  return (
    <div className={cn(isWideLayout ? "overflow-hidden" : "min-w-0 overflow-x-hidden")}>
      <PostingsTableHeader headerRef={tableHeaderRef} isWideLayout={isWideLayout} />
      <ul
        className={cn(
          "w-full min-w-0 bg-card",
          isWideLayout && "grid overflow-hidden",
        )}
        style={style}
      >
        {postings.map((posting) => (
          <HomePostingRow
            key={posting.id}
            posting={posting}
            flexHeight={flexRows}
            isWideLayout={isWideLayout}
          />
        ))}
        {Array.from({ length: paddingRows }, (_, index) => (
          <HomeEmptyPostingRow
            key={`${idPrefix}-pad-${index}`}
            flexHeight={flexRows}
            isWideLayout={isWideLayout}
          />
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
  isWideLayout,
}: {
  postings: FeedPosting[];
  slotCount: number;
  recentTotal: number;
  splitBelow?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  tableHeaderRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
  isWideLayout: boolean;
}) {
  if (slotCount === 0 && recentTotal === 0) {
    return (
      <section className={cn(HOME_SECTION, splitBelow && HOME_SECTION_SPLIT_BELOW)}>
        <div className={HOME_SECTION_HEADER}>
          <HomeSectionHeader title="Recent" className="mb-0" />
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
        isWideLayout={isWideLayout}
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
  isWideLayout,
}: {
  postings: FeedPosting[];
  slotCount: number;
  savedTotal: number;
  splitAbove?: boolean;
  headerRef?: Ref<HTMLDivElement>;
  bodyHeightPx?: number;
  isWideLayout: boolean;
}) {
  if (savedTotal === 0) return null;

  if (slotCount === 0) return null;

  return (
    <section className={cn(HOME_SECTION, splitAbove && HOME_SECTION_SPLIT_ABOVE)}>
      <div ref={headerRef} className={HOME_SECTION_HEADER}>
        <HomeSectionHeader
          title="Saved for later"
          actions={<HomeHeaderArrowLink href="/openings" label="View saved roles" />}
          className="mb-0"
        />
      </div>
      <PostingsTableBody
        postings={postings}
        slotCount={slotCount}
        idPrefix="saved"
        bodyHeightPx={bodyHeightPx}
        isWideLayout={isWideLayout}
      />
    </section>
  );
}
