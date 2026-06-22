import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  CalendarRange,
  Clock,
  LogIn,
  MapPin,
  MousePointer2,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { SeasonBadge } from "@/components/season-badge";
import { formatPostingRelativeTime } from "@/lib/feed/posted-display";
import { parseCompanySlugFromSourceId } from "@/lib/feed/company-slug";
import { formatCompactLocationSegments } from "@/lib/feed/us-locations";
import { LANDING_OPENINGS_DAYS } from "@/lib/landing/openings-preview";
import { SchoolLogoGrid } from "@/components/landing/school-logo-grid";
import type { LandingOpeningPreview } from "@/lib/landing/openings-preview-data";
import type { FeedPosting } from "@/lib/feed/types";
import { LINK_MUTED_CLASS } from "@/lib/ui/link-styles";
import { safeExternalHref } from "@/lib/url";
import { cn } from "@/lib/utils";
import { MarketingNav, Wordmark } from "./marketing-nav";
import { HeroKineticHeadline } from "./hero-kinetic-headline";
import { OpeningsScrollGate } from "./openings-scroll-gate";
import "./marketing-landing.css";

const landingDisplay = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-landing-display",
  display: "swap",
});

/** Roles newer than this read as freshly posted and get the "New" marker. */
const FRESH_WINDOW_SECONDS = 60 * 60 * 48;

const BODY_CELL =
  "flex min-h-full min-w-0 items-center px-3.5 py-2.5 sm:px-5";

const HEADER_CELL =
  "flex min-h-full items-center px-3.5 py-0 sm:px-5";

const LANDING_HEADER_ICONS: Record<string, LucideIcon> = {
  Company: Building2,
  Role: Briefcase,
  Location: MapPin,
  Season: CalendarRange,
  Posted: Clock,
};

function LandingTableHeaderCell({ label, className }: { label: string; className?: string }) {
  const Icon = LANDING_HEADER_ICONS[label];
  const centered = label === "Season";
  const rightAligned = label === "Posted";

  return (
    <div className={cn(HEADER_CELL, centered && "justify-center", rightAligned && "justify-end", className)}>
      <span
        className={cn(
          "flex items-center gap-1.5 py-1.5 text-[13px] font-medium text-muted-foreground",
          centered && "justify-center",
          rightAligned && "justify-end",
        )}
      >
        {Icon ? (
          <Icon size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground/70" aria-hidden />
        ) : null}
        {label}
      </span>
    </div>
  );
}

function OpeningRow({ posting, nowUnix }: { posting: FeedPosting; nowUnix: number }) {
  const href = safeExternalHref(posting.url);
  const companySlug = parseCompanySlugFromSourceId(posting.sourceId);
  const locationLabel = formatCompactLocationSegments(posting.locations, 1) || "Worldwide";
  const ageLabel = formatPostingRelativeTime(posting.postedDisplay) || "—";
  const isFresh =
    posting.pathwayNewUnix > 0 && nowUnix - posting.pathwayNewUnix < FRESH_WINDOW_SECONDS;

  return (
    <li className="mkt-row min-h-[3.125rem] items-stretch border-b border-border/35 text-left transition-colors last:border-b-0 hover:bg-muted/20">
      <div className={BODY_CELL}>
        <span className="flex min-w-0 items-center gap-3">
          <CompanyLogo
            company={posting.company}
            companySlug={companySlug}
            logoAssetKey={posting.companyLogoAssetKey}
            websiteUrl={posting.companyWebsiteUrl}
            size={26}
            lazy
          />
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{posting.company}</span>
            {isFresh ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 leading-none">
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <span className="text-[10px] font-medium text-primary">New</span>
              </span>
            ) : null}
          </span>
        </span>
      </div>
      <div className={BODY_CELL}>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("min-w-0 truncate text-sm", LINK_MUTED_CLASS)}
          >
            {posting.title}
          </a>
        ) : (
          <span className="min-w-0 truncate text-sm text-foreground/90">{posting.title}</span>
        )}
      </div>
      <div className={cn(BODY_CELL, "mkt-cell-loc")}>
        <span className="min-w-0 truncate text-sm text-foreground/80">{locationLabel}</span>
      </div>
      <div className={cn(BODY_CELL, "mkt-cell-season justify-center")}>
        {posting.season ? <SeasonBadge season={posting.season} variant="plain" className="shrink-0" /> : null}
      </div>
      <div className={cn(BODY_CELL, "justify-end")}>
        <span className="min-w-0 truncate text-right text-sm tabular-nums text-foreground/80">{ageLabel}</span>
      </div>
    </li>
  );
}

function LiveOpeningsBoard({
  preview,
  nowUnix,
}: {
  preview: LandingOpeningPreview;
  nowUnix: number;
}) {
  const hasRows = preview.postings.length > 0;

  return (
    <div className="mkt-product-wrap mkt-anim" style={{ animationDelay: "280ms" }}>
      <div className="mkt-product-rail">
        <div className="mkt-product-frame" aria-label="Recent internship openings">
          {hasRows ? (
            <>
              <div className="mkt-row mkt-row-head items-stretch border-b border-border/35">
                <LandingTableHeaderCell label="Company" />
                <LandingTableHeaderCell label="Role" />
                <LandingTableHeaderCell label="Location" className="mkt-cell-loc" />
                <LandingTableHeaderCell label="Season" className="mkt-cell-season" />
                <LandingTableHeaderCell label="Posted" />
              </div>
              <OpeningsScrollGate previewDays={LANDING_OPENINGS_DAYS}>
                <ul>
                  {preview.postings.map((posting) => (
                    <OpeningRow key={posting.id} posting={posting} nowUnix={nowUnix} />
                  ))}
                </ul>
              </OpeningsScrollGate>
            </>
          ) : (
            <div className="flex flex-col items-start gap-4 px-5 py-12">
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Fresh openings appear here as soon as our next scrape runs. Create a free account to
                browse the full catalog and set up alerts.
              </p>
              <Link href="/register" className="lp-cta lp-cta--primary">
                <UserRoundPlus size={15} strokeWidth={1.75} aria-hidden />
                Create free account
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export function MarketingLanding({
  openingsPreview,
}: {
  openingsPreview: LandingOpeningPreview;
}) {
  // Captured once per server render — freshness markers are request-time stable.
  // eslint-disable-next-line react-hooks/purity
  const nowUnix = Math.floor(Date.now() / 1000);

  return (
    <div className={cn("mkt-shell", landingDisplay.variable)}>
      <MarketingNav />

      <main>
        <section className="mkt-stage" id="openings" aria-label="Pathway openings preview">
          <div className="mkt-rail mkt-hero-inner">
            <HeroKineticHeadline className="mkt-anim" style={{ animationDelay: "0ms" }} />

            <div className="mkt-hero-actions mkt-anim" style={{ animationDelay: "60ms" }}>
              <Link href="/register" className="lp-cta lp-cta--primary mkt-hero-cta">
                <MousePointer2 className="mkt-hero-cta-icon-ne" size={15} strokeWidth={1.75} aria-hidden />
                Get started
              </Link>
              <Link href="/login" className="lp-cta lp-cta--secondary mkt-hero-cta">
                <LogIn size={15} strokeWidth={1.75} aria-hidden />
                Sign in
              </Link>
            </div>
          </div>

          <LiveOpeningsBoard preview={openingsPreview} nowUnix={nowUnix} />
        </section>

        <section className="mkt-proof" aria-label="Schools using Pathway">
          <div className="mkt-proof-label-strip">
            <div className="mkt-product-rail">
              <div className="mkt-proof-label-row">
                <span className="mkt-proof-label-line" aria-hidden />
                <p className="mkt-proof-label">Used by students at</p>
                <span className="mkt-proof-label-line" aria-hidden />
              </div>
            </div>
          </div>
          <div className="mkt-proof-logos">
            <SchoolLogoGrid />
          </div>
        </section>

        <section className="mkt-close" aria-label="Create your Pathway account">
          <div className="mkt-rail">
            <div className="lp-final-card mkt-close-card">
              <p className="mkt-close-title">Built by students, for students. $0 for life.</p>
              <Link href="/register" className="lp-cta lp-cta--primary mkt-hero-cta">
                <UserRoundPlus size={15} strokeWidth={1.75} aria-hidden />
                Create free account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mkt-footer">
        <div className="mkt-rail mkt-footer-inner">
          <Wordmark />
          <span className="mkt-footer-copy">© {new Date().getFullYear()} Pathway</span>
        </div>
      </footer>
    </div>
  );
}
