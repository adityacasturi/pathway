import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ListChecks, Gift, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { LandingProductStory } from "@/components/landing-product-story";
import { OfferTimelineMock } from "@/components/landing/mocks/offer-timeline-mock";
import { ComparisonTable } from "@/components/landing/comparison-table";
import { SchoolLogoCarousel } from "@/components/school-logo-carousel";
import { TrustBand } from "@/components/landing/trust-band";
import { pageMainPadding, pageWidths } from "@/components/ui/page";

const landingWidth = pageWidths.xl;
const landingPad = pageMainPadding;

export const dynamic = "force-dynamic";

const PIPELINE_POINTS = [
  {
    title: "A timeline for every role",
    body: "Applied, online assessment, interviews, offer. Each application keeps an ordered, dated history you can read in seconds.",
  },
  {
    title: "Status that keeps itself current",
    body: "Log an event and the status updates on its own. No dropdowns to babysit and no stale rows to clean up.",
  },
  {
    title: "Nothing slips through the cracks",
    body: "Notes, dates, and next steps stay attached to the role, so you walk into every round knowing exactly where you left off.",
  },
] as const;

export default async function LandingRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/home");

  return <LandingPage />;
}

function LandingPage() {
  return (
    <main className="landing-shell bg-background text-foreground">
      <header className={cn("mx-auto w-full pt-4 sm:pt-6", landingWidth, landingPad)}>
        <div className="flex h-16 items-center justify-between sm:h-18">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link href="/" aria-label="Pathway home" className="inline-flex items-center">
              <Image
                src="/brand/pathway-logo-black-transparent-600w.png"
                alt="Pathway"
                width={600}
                height={148}
                priority
                className="brand-wordmark h-[36px] w-auto sm:h-[40px]"
              />
            </Link>
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              style={{ borderColor: "var(--rule)" }}
            >
              <span className="block size-1.5 rounded-full bg-[color:var(--primary)]" />
              v2.0 out now
            </span>
          </div>
          <nav aria-label="Public navigation" className="flex items-center gap-2">
            <Link
              href="/login"
              className="public-nav-button public-nav-button-secondary"
              style={{ borderColor: "var(--rule)" }}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="public-nav-button public-nav-button-primary"
            >
              Get started <ArrowRight size={13} strokeWidth={1.8} />
            </Link>
          </nav>
        </div>
        <span aria-hidden className="landing-header-rule block h-px w-full" />
      </header>

      <section className={cn("landing-hero mx-auto w-full pb-10 pt-14", landingWidth, landingPad)}>
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="landing-offer mb-8">
            <p className="landing-offer-title">
              <Gift size={14} strokeWidth={1.8} className="text-[color:var(--primary)]" />
              <span>
                <em>100% free</em> for students
              </span>
            </p>
          </div>
          <h1 className="landing-hero-title mx-auto max-w-6xl text-[3.4rem] text-foreground sm:text-[4.75rem] lg:text-[6.25rem]">
            <span>Beat the crowd</span>
            <span>to new internships.</span>
          </h1>
          <p className="lp-hero-sub mt-7 max-w-2xl">
            Pathway checks 400+ company career pages every 15 minutes and surfaces new internships
            the moment they post, so you apply before the listing makes the rounds.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/register" className="lp-cta lp-cta--primary">
              Get started free <ArrowRight size={15} strokeWidth={1.9} />
            </Link>
            <a href="#product" className="lp-cta lp-cta--secondary">
              See it in action
            </a>
          </div>

          <div className="mx-auto mt-9 w-full max-w-5xl">
            <SchoolLogoCarousel />
          </div>
        </div>
      </section>

      <TrustBand />

      <section
        id="product"
        className={cn("mx-auto w-full pb-10 pt-36 sm:pt-48", landingWidth, landingPad)}
      >
        <div className="lp-section-head mb-6">
          <span className="label-micro">The product</span>
          <h2 className="display-serif mt-4 max-w-4xl text-[2rem] text-foreground sm:text-[2.75rem]">
            Everything your search needs, nothing it doesn&apos;t.
          </h2>
        </div>
        <LandingProductStory />
      </section>

      <section className={cn("lp-speed mx-auto w-full py-20", landingWidth, landingPad)}>
        <div className="lp-speed-grid">
          <div className="lp-speed-copy">
            <span className="label-micro lp-accent-label">
              <ListChecks size={12} strokeWidth={2} /> Track every application
            </span>
            <h2 className="display-serif mt-4 text-[2rem] text-foreground sm:text-[2.6rem]">
              From first application to signed offer.
            </h2>
            <p className="lp-section-sub mt-5">
              Every role you track gets a living timeline. Log a screen, an interview, an offer, and
              Pathway keeps your status in sync, so you always know exactly where each application
              stands.
            </p>
            <ul className="lp-speed-list mt-8">
              {PIPELINE_POINTS.map((point) => (
                <li key={point.title} className="lp-speed-item">
                  <h3 className="lp-speed-item-title">{point.title}</h3>
                  <p className="lp-speed-item-body">{point.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-speed-media">
            <div className="landing-product-frame">
              <OfferTimelineMock />
            </div>
          </div>
        </div>
      </section>

      <section className={cn("lp-compare mx-auto w-full py-20", landingWidth, landingPad)}>
        <div className="lp-section-head lp-section-head--center mb-10">
          <span className="label-micro lp-accent-label">
            <Sparkles size={12} strokeWidth={2} /> Why Pathway
          </span>
          <h2 className="display-serif mt-4 text-[2rem] text-foreground sm:text-[2.6rem]">
            How we stack up against the alternatives.
          </h2>
          <p className="lp-section-sub lp-section-sub--center mt-5">
            Pathway watches company career pages on a 15-minute loop and alerts you when new
            internships post. Simplify and a spreadsheet won&apos;t tell you the moment a role goes live.
          </p>
        </div>
        <ComparisonTable />
      </section>

      <section className={cn("lp-final mx-auto w-full pb-28 pt-10", landingWidth, landingPad)}>
        <div className="lp-final-card">
          <span className="label-micro lp-accent-label">Free for students</span>
          <h2 className="landing-hero-title mt-5 text-[2.75rem] text-foreground sm:text-[4rem]">
            <span>Never miss a new</span>
            <span>internship again.</span>
          </h2>
          <p className="lp-section-sub lp-section-sub--center mx-auto mt-6 max-w-2xl">
            Join students using Pathway to catch new internships soon after they post and apply
            before the rush.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="lp-cta lp-cta--primary">
              Create your free account <ArrowRight size={15} strokeWidth={1.9} />
            </Link>
            <Link href="/login" className="lp-cta lp-cta--secondary">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className={cn("lp-footer mx-auto w-full pb-12", landingWidth, landingPad)}>
        <span className="rule mb-6" />
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Image
            src="/brand/pathway-logo-black-transparent-600w.png"
            alt="Pathway"
            width={600}
            height={148}
            className="brand-wordmark h-7 w-auto opacity-70"
          />
          <p className="label-meta">{new Date().getFullYear()}</p>
        </div>
      </footer>
    </main>
  );
}
