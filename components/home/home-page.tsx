"use client";

import { HomeBriefingCard } from "@/components/home/home-briefing-card";
import { HomeAlertActivityPanel } from "@/components/home/home-alert-activity-panel";
import { HomeHotCompaniesPanel } from "@/components/home/home-hot-companies-panel";
import {
  HomeRecentPostingsPanel,
  HomeSavedPostingsPanel,
} from "@/components/home/home-postings-panel";
import { useHomeDashboardLayout } from "@/components/home/use-home-dashboard-layout";
import { HOME_PIPELINE_RAIL } from "@/components/home/home-section-styles";
import { PageShell } from "@/components/design-system/page";
import type { HomeAlertActivityRow } from "@/lib/home/alert-activity";
import type { FeedPosting } from "@/lib/feed/source";
import type { SeasonSnapshot } from "@/lib/home/season-snapshot";
import type { HotCompany } from "@/lib/home/briefing";

export function HomePage({
  seasonSnapshot,
  hotCompanies,
  alertActivity,
  savedPostings,
  savedTotal,
  recentPostings,
  recentTotal,
}: {
  seasonSnapshot: SeasonSnapshot;
  hotCompanies: HotCompany[];
  alertActivity: HomeAlertActivityRow[];
  savedPostings: FeedPosting[];
  savedTotal: number;
  recentPostings: FeedPosting[];
  recentTotal: number;
}) {
  const hotCompaniesTotal = hotCompanies.length;
  const alertActivityTotal = alertActivity.length;

  const {
    freshSlotCount,
    savedSlotCount,
    hotCompanySlotCount,
    alertActivitySlotCount,
    recentBodyHeightPx,
    savedBodyHeightPx,
    hotCompanyBodyHeightPx,
    alertActivityBodyHeightPx,
    gridRef,
    leftColumnRef,
    rightColumnRef,
    recentHeaderRef,
    savedHeaderRef,
    hotHeaderRef,
    alertActivityHeaderRef,
    postingTableHeaderRef,
  } = useHomeDashboardLayout(recentTotal, savedTotal, hotCompaniesTotal, alertActivityTotal);

  return (
    <PageShell className="flex h-full min-h-0 flex-col overflow-hidden">
      <section className="flex h-full min-h-0 flex-col bg-card">
        <header className={HOME_PIPELINE_RAIL}>
          <HomeBriefingCard seasonSnapshot={seasonSnapshot} />
        </header>

        <div
          ref={gridRef}
          className="grid min-h-0 flex-1 items-stretch lg:grid-cols-[minmax(0,1.15fr)_minmax(11rem,0.62fr)]"
        >
          <div
            ref={leftColumnRef}
            className="flex h-full min-h-0 flex-col lg:border-r lg:border-border"
          >
            <HomeRecentPostingsPanel
              postings={recentPostings.slice(0, freshSlotCount)}
              slotCount={freshSlotCount}
              recentTotal={recentTotal}
              headerRef={recentHeaderRef}
              tableHeaderRef={postingTableHeaderRef}
              bodyHeightPx={recentBodyHeightPx}
              splitBelow={savedTotal > 0}
            />
            {savedTotal > 0 ? (
              <HomeSavedPostingsPanel
                postings={savedPostings.slice(0, savedSlotCount)}
                slotCount={savedSlotCount}
                savedTotal={savedTotal}
                splitAbove
                headerRef={savedHeaderRef}
                bodyHeightPx={savedBodyHeightPx}
              />
            ) : null}
          </div>

          <aside
            ref={rightColumnRef}
            aria-label="Market sidebar"
            className="flex h-full min-h-0 flex-col"
          >
            <HomeHotCompaniesPanel
              companies={hotCompanies.slice(0, hotCompanySlotCount)}
              slotCount={hotCompanySlotCount}
              headerRef={hotHeaderRef}
              bodyHeightPx={hotCompanyBodyHeightPx}
              splitBelow={alertActivityTotal > 0}
            />
            {alertActivityTotal > 0 ? (
              <HomeAlertActivityPanel
                rows={alertActivity.slice(0, alertActivitySlotCount)}
                allRows={alertActivity}
                slotCount={alertActivitySlotCount}
                splitAbove
                headerRef={alertActivityHeaderRef}
                bodyHeightPx={alertActivityBodyHeightPx}
              />
            ) : null}
          </aside>
        </div>
      </section>
    </PageShell>
  );
}
