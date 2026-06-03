"use client";

import Link from "next/link";
import { HomeSnapshot } from "@/components/home/home-snapshot";
import { HotCompaniesList } from "@/components/stats/hot-companies";
import { IndustrySpotlight } from "@/components/stats/industry-spotlight";
import { SankeyDiagram } from "@/components/stats/sankey-diagram";
import {
  computeStats,
  formatDays,
  formatDecimal,
  formatPercent,
  MonthlyCount,
  pluralize,
  sampleDetail,
  StageCount,
} from "@/lib/stats/applications";
import { getPageLabel } from "@/lib/config/nav";
import type { MarketStats } from "@/lib/stats/market";
import { PageHeader, PageMain, PageSection, PageShell } from "@/components/ui/page";
import type { Application } from "@/types/application";

interface Props {
  applications: Application[];
  market: MarketStats;
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-[17px] font-medium text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const className =
    "flex min-h-[5.5rem] flex-col justify-center rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-[color:var(--rule-strong)] hover:bg-[color-mix(in_oklab,var(--ink)_2%,var(--card))]";
  const content = (
    <>
      <span className="figure-label">{label}</span>
      <span className="mt-2 font-mono text-[1.75rem] leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </span>
      <p className="mt-2 label-meta">{detail}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function PipelineTimingGrid({
  positiveSignals,
  total,
  avgDaysToOa,
  avgDaysToInterview,
  stageCounts,
  oaSampleSize,
  interviewSampleSize,
}: {
  positiveSignals: number;
  total: number;
  avgDaysToOa: number | null;
  avgDaysToInterview: number | null;
  stageCounts: StageCount;
  oaSampleSize: number;
  interviewSampleSize: number;
}) {
  const cards = [
    {
      label: "Positive signal",
      value: formatPercent(positiveSignals, total),
      detail: `${positiveSignals} reached OA or better`,
    },
    {
      label: "Avg time to OA",
      value: formatDays(avgDaysToOa),
      detail: oaSampleSize > 0 ? sampleDetail(oaSampleSize) : "No OAs yet",
    },
    {
      label: "Avg time to interview",
      value: formatDays(avgDaysToInterview),
      detail:
        interviewSampleSize > 0 ? sampleDetail(interviewSampleSize) : "No interviews yet",
    },
    {
      label: "Offer rate",
      value: formatPercent(stageCounts.offer, total),
      detail: `${stageCounts.offer} offer${stageCounts.offer === 1 ? "" : "s"}`,
      href: "/applications?status=offer",
    },
  ];

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <li key={card.label}>
          <MetricCard {...card} />
        </li>
      ))}
    </ul>
  );
}

function SearchDetailGrid({
  total,
  noResponseCount,
  inProcessCount,
  avgDaysToFirstProgress,
  avgDaysToOffer,
  avgDaysToRejection,
  avgInterviewRounds,
  maxInterviewRounds,
  avgApplicationsPerMonth,
  peakMonth,
  firstProgressSampleSize,
  offerSampleSize,
  rejectionSampleSize,
}: {
  total: number;
  noResponseCount: number;
  inProcessCount: number;
  avgDaysToFirstProgress: number | null;
  avgDaysToOffer: number | null;
  avgDaysToRejection: number | null;
  avgInterviewRounds: number | null;
  maxInterviewRounds: number;
  avgApplicationsPerMonth: number | null;
  peakMonth: MonthlyCount | null;
  firstProgressSampleSize: number;
  offerSampleSize: number;
  rejectionSampleSize: number;
}) {
  const stats = [
    {
      label: "No response",
      value: noResponseCount.toString(),
      detail: `${formatPercent(noResponseCount, total)} of active apps`,
    },
    {
      label: "In process",
      value: inProcessCount.toString(),
      detail: "No final outcome yet",
    },
    {
      label: "Avg first response",
      value: formatDays(avgDaysToFirstProgress),
      detail:
        firstProgressSampleSize > 0 ? sampleDetail(firstProgressSampleSize) : "No responses yet",
    },
    {
      label: "Avg time to offer",
      value: formatDays(avgDaysToOffer),
      detail: offerSampleSize > 0 ? sampleDetail(offerSampleSize) : "No offers yet",
    },
    {
      label: "Avg time to rejection",
      value: formatDays(avgDaysToRejection),
      detail:
        rejectionSampleSize > 0 ? sampleDetail(rejectionSampleSize) : "No rejections yet",
    },
    {
      label: "Interview depth",
      value:
        maxInterviewRounds > 0
          ? `${maxInterviewRounds} ${pluralize(maxInterviewRounds, "round")}`
          : "n/a",
      detail:
        avgInterviewRounds != null
          ? `${formatDecimal(avgInterviewRounds)} avg rounds`
          : "No interviews yet",
    },
    {
      label: "Avg apps / month",
      value: formatDecimal(avgApplicationsPerMonth),
      detail: "Across months shown",
    },
    {
      label: "Peak month",
      value: peakMonth?.label ?? "n/a",
      detail: peakMonth
        ? `${peakMonth.count} ${pluralize(peakMonth.count, "application")}`
        : "No dates yet",
    },
  ];

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <li key={stat.label}>
          <MetricCard label={stat.label} value={stat.value} detail={stat.detail} />
        </li>
      ))}
    </ul>
  );
}

export function StatsPage({ applications, market }: Props) {
  const activeApplications = applications.filter((application) => !application.archived_at);
  const {
    active,
    archivedCount,
    stageCounts,
    positiveSignals,
    noResponseCount,
    inProcessCount,
    avgDaysToOa,
    avgDaysToInterview,
    avgDaysToFirstProgress,
    avgDaysToOffer,
    avgDaysToRejection,
    avgInterviewRounds,
    maxInterviewRounds,
    avgApplicationsPerMonth,
    peakMonth,
    oaSampleSize,
    interviewSampleSize,
    firstProgressSampleSize,
    offerSampleSize,
    rejectionSampleSize,
    sankey,
  } = computeStats(applications);

  const catalogHiringLabel =
    market.catalogHiringRate != null ? `${market.catalogHiringRate}%` : "n/a";
  const avgRolesLabel =
    market.avgOpenRolesPerCompany != null
      ? formatDecimal(market.avgOpenRolesPerCompany)
      : "n/a";

  return (
    <PageShell>
      <PageMain width="xl">
        <PageHeader title={getPageLabel("/insights")} />

        {active.length === 0 ? (
          <PageSection rule={false} className="mb-10">
            <div
              className="rounded-xl border bg-card px-4 py-4"
              style={{ borderColor: "var(--rule)" }}
            >
              <p className="text-[15px] font-medium text-foreground">
                Add applications to unlock your search metrics.
              </p>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                Insights will calculate response rates, timing, and pipeline flow after you track
                roles and log events. Start manually or add a role from Openings.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/applications"
                  className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background px-4 text-[13px] font-medium text-foreground transition-colors hover:border-[color:var(--rule-strong)]"
                >
                  Add an application
                </Link>
                <Link
                  href="/openings"
                  className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-background/70 px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:border-[color:var(--rule-strong)] hover:text-foreground"
                >
                  Track from Openings
                </Link>
              </div>
            </div>
          </PageSection>
        ) : null}

        <PageSection rule={false} className="mb-12">
          <SectionHeading
            title="Your pipeline"
            description={
              archivedCount > 0
                ? `${active.length} active · ${archivedCount} archived`
                : "How your applications are progressing."
            }
          />
          <HomeSnapshot applications={activeApplications} showReachPercent />
        </PageSection>

        <PageSection rule={false} className="mb-12">
          <SectionHeading title="Pipeline timing" description="Rates and response times across your search." />
          <PipelineTimingGrid
            positiveSignals={positiveSignals}
            total={active.length}
            avgDaysToOa={avgDaysToOa}
            avgDaysToInterview={avgDaysToInterview}
            stageCounts={stageCounts}
            oaSampleSize={oaSampleSize}
            interviewSampleSize={interviewSampleSize}
          />
        </PageSection>

        <PageSection rule={false} className="mb-12">
          <SectionHeading title="Search detail" description="Timing and volume across your search." />
          <SearchDetailGrid
            total={active.length}
            noResponseCount={noResponseCount}
            inProcessCount={inProcessCount}
            avgDaysToFirstProgress={avgDaysToFirstProgress}
            avgDaysToOffer={avgDaysToOffer}
            avgDaysToRejection={avgDaysToRejection}
            avgInterviewRounds={avgInterviewRounds}
            maxInterviewRounds={maxInterviewRounds}
            avgApplicationsPerMonth={avgApplicationsPerMonth}
            peakMonth={peakMonth}
            firstProgressSampleSize={firstProgressSampleSize}
            offerSampleSize={offerSampleSize}
            rejectionSampleSize={rejectionSampleSize}
          />
        </PageSection>

        <PageSection rule={false} className="mb-12">
          <SectionHeading
            title="Market pulse"
            description="Open US internship roles scraped from tracked companies."
          />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <MetricCard
                label="Open roles"
                value={market.pulse.openTotal.toLocaleString("en-US")}
                detail={`${market.catalog.companiesWithOpenRoles} companies hiring`}
                href="/openings"
              />
            </li>
            <li>
              <MetricCard
                label="New since yesterday"
                value={market.pulse.sinceYesterday.toLocaleString("en-US")}
                detail={
                  market.pulse.dominantSeason
                    ? `Mostly ${market.pulse.dominantSeason}`
                    : "First seen in Pathway"
                }
                href="/openings"
              />
            </li>
            <li>
              <MetricCard
                label="Catalog hiring"
                value={catalogHiringLabel}
                detail={`${market.catalog.companiesWithOpenRoles} of ${market.catalog.discoverCompanies} companies`}
                href="/companies"
              />
            </li>
            <li>
              <MetricCard
                label="Company catalog"
                value={market.catalog.discoverCompanies.toLocaleString("en-US")}
                detail="Active companies tracked"
                href="/companies"
              />
            </li>
          </ul>

          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <MetricCard
                label="Posted this week"
                value={market.week.postedCount.toLocaleString("en-US")}
                detail={`${market.week.activeCompanyCount} companies active`}
              />
            </li>
            <li>
              <MetricCard
                label="Top season"
                value={market.week.topSeason ?? "n/a"}
                detail="By postings this week"
              />
            </li>
            <li>
              <MetricCard
                label="Avg roles / company"
                value={avgRolesLabel}
                detail="Among companies with open roles"
              />
            </li>
            <li>
              <MetricCard
                label="Top location"
                value={market.week.topLocation?.label ?? "n/a"}
                detail={
                  market.week.topLocation
                    ? `${market.week.topLocation.count} roles this week`
                    : "No location data"
                }
              />
            </li>
          </ul>
        </PageSection>

        <div className="mb-12 grid gap-3 lg:grid-cols-2">
          <IndustrySpotlight industries={market.industries} />
          <HotCompaniesList companies={market.hotCompanies} />
        </div>

        <PageSection
          title="Pipeline flow"
          meta={`${active.length} active`}
          className="mb-12"
          contentClassName="pt-1"
          rule={false}
        >
          <SankeyDiagram nodes={sankey.nodes} links={sankey.links} total={active.length} />
        </PageSection>
      </PageMain>
    </PageShell>
  );
}
