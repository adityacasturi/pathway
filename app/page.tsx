import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { HeroCompanyCardFan } from "@/components/hero-company-card-fan";
import { LandingProductStory } from "@/components/landing-product-story";
import { LandingScrollCue } from "@/components/landing-scroll-cue";
import { SchoolLogoCarousel } from "@/components/school-logo-carousel";

export const dynamic = "force-dynamic";

const PRODUCT_SHOTS = [
  {
    src: "/product-screenshots/landing-home.png",
    alt: "Pathway home page with new internships, OA deadlines, and saved postings",
    eyebrow: "01 / Daily search",
    title: "Start each day with the roles that need attention.",
    body: "New postings, upcoming OA deadlines, and saved roles sit together so the next move is obvious.",
    width: 3456,
    height: 1988,
  },
  {
    src: "/product-screenshots/landing-applications.png",
    alt: "Pathway applications table with filters, application counts, and internship rows",
    eyebrow: "02 / Pipeline",
    title: "Track every role without losing the thread.",
    body: "Applications, statuses, deadlines, filters, and notes live in one calm pipeline built for repeated daily scanning.",
    width: 3450,
    height: 1976,
  },
  {
    src: "/product-screenshots/landing-discover.png",
    alt: "Pathway discover page with internship postings and save controls",
    eyebrow: "03 / Discovery",
    title: "Find relevant internships from the same workspace.",
    body: "Browse fresh roles, save promising postings, and keep the search connected to the applications you are already tracking.",
    width: 3456,
    height: 1988,
  },
  {
    src: "/product-screenshots/landing-stats.png",
    alt: "Pathway stats page showing recruiting metrics and Sankey flow",
    eyebrow: "04 / Progress",
    title: "See where your search is moving.",
    body: "Stats turn your pipeline into a quick read on signal, timing, conversion, and where applications are getting stuck.",
    width: 3456,
    height: 1988,
  },
  {
    src: "/product-screenshots/landing-detail.png",
    alt: "Pathway application detail panel with timeline, details, and event controls",
    eyebrow: "05 / Details",
    title: "Keep every application's story in one place.",
    body: "Capture timeline events, interview rounds, deadlines, notes, location, and season without digging through scattered docs.",
    width: 1526,
    height: 1670,
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
      <header className="mx-auto w-full max-w-7xl px-5 pt-4 sm:px-8 sm:pt-6 lg:px-12">
        <div className="flex h-16 items-center justify-between sm:h-18">
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

      <section className="landing-hero mx-auto grid w-full max-w-7xl gap-8 px-5 pb-12 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.75fr)] lg:px-12">
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="landing-hero-title max-w-6xl text-[3.65rem] text-foreground sm:text-[5.15rem] lg:text-[7.35rem]">
            <span>Find roles faster.</span>
            <span>Track every application.</span>
          </h1>
          <p className="landing-hero-copy mt-6 max-w-2xl text-[17px] leading-7 text-muted-foreground">
            Discover the roles worth chasing, stay organized, and give yourself a clearer path to landing your dream internship.
          </p>
          <div className="landing-offer mt-6 max-w-xl">
            <p className="landing-offer-title">
              <span>
                Now open for students with a <em>.edu</em> email
              </span>
            </p>
          </div>
          <div className="mt-12 max-w-lg">
            <SchoolLogoCarousel />
          </div>
        </div>
        <HeroCompanyCardFan />
        <LandingScrollCue />
      </section>

      <section id="product" className="mx-auto w-full max-w-[88rem] px-5 pb-24 sm:px-8 lg:px-12">
        <LandingProductStory shots={PRODUCT_SHOTS} />
      </section>
    </main>
  );
}
