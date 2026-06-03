import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { LandingProductStory } from "@/components/landing-product-story";
import { SchoolLogoCarousel } from "@/components/school-logo-carousel";
import { TrustBand } from "@/components/landing/trust-band";
import { pageMainPadding, pageWidths } from "@/components/ui/page";

const landingWidth = pageWidths.xl;
const landingPad = pageMainPadding;

export const dynamic = "force-dynamic";

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
                className="brand-wordmark h-7 w-auto sm:h-[40px]"
              />
            </Link>
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

      <section className={cn("landing-hero mx-auto w-full pb-8 pt-10", landingWidth, landingPad)}>
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="landing-offer mb-5">
            <div className="landing-offer-badge">
              <span className="landing-offer-dot" aria-hidden />
              <span className="landing-offer-badge__label">New · real-time alerts</span>
            </div>
          </div>
          <h1 className="landing-hero-title mx-auto w-full max-w-6xl text-[3.25rem] text-foreground sm:text-[4.35rem] lg:text-[5.65rem]">
            <span>Beat the crowd</span>
            <span>to new internships.</span>
          </h1>
          <p className="lp-hero-sub mt-6 max-w-2xl">
            Pathway checks hundreds of company career pages every 15 minutes and surfaces new
            internships quickly, so you apply before the listing makes the rounds.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="lp-cta lp-cta--primary">
              Get started <ArrowRight size={15} strokeWidth={1.9} />
            </Link>
            <a href="#product" className="lp-cta lp-cta--secondary">
              See it in action
            </a>
          </div>

          <div className="mx-auto mt-6 w-full max-w-5xl">
            <SchoolLogoCarousel />
          </div>
        </div>
      </section>

      <TrustBand />

      <section id="product" className={cn("mx-auto w-full pb-10 pt-16 sm:pt-20", landingWidth, landingPad)}>
        <div className="lp-section-head mb-6">
          <span className="label-micro">The product</span>
          <h2 className="display-serif mt-4 max-w-4xl text-[2rem] text-foreground sm:text-[2.75rem]">
            Everything your search needs, nothing it doesn&apos;t.
          </h2>
        </div>
        <LandingProductStory />
      </section>

      <section className={cn("lp-final mx-auto w-full pb-28 pt-10", landingWidth, landingPad)}>
        <div className="lp-final-card">
          <span className="label-micro lp-accent-label">Get started</span>
          <h2 className="landing-hero-title mt-5 text-[2.75rem] text-foreground sm:text-[4rem]">
            <span>Never miss a new</span>
            <span>internship again.</span>
          </h2>
          <p className="lp-section-sub lp-section-sub--center mx-auto mt-6 max-w-2xl">
            Create a free account to track applications, browse openings, explore companies, and
            get email alerts for new roles.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="lp-cta lp-cta--primary">
              Create your account <ArrowRight size={15} strokeWidth={1.9} />
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
