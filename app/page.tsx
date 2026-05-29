import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LandingProductStory } from "@/components/landing-product-story";
import { LandingScrollCue } from "@/components/landing-scroll-cue";
import { SchoolLogoCarousel } from "@/components/school-logo-carousel";

export const dynamic = "force-dynamic";

const PRODUCT_SHOTS = [
  {
    src: "/product-screenshots/landing-home.png",
    alt: "Pathway home page with new internships, OA deadlines, and saved postings",
    title: "Home",
    width: 3456,
    height: 1988,
  },
  {
    src: "/product-screenshots/landing-applications.png",
    alt: "Pathway applications table with filters, application counts, and internship rows",
    title: "Applications",
    width: 3450,
    height: 1976,
  },
  {
    src: "/product-screenshots/landing-discover.png",
    alt: "Pathway discover page with internship postings and save controls",
    title: "Discover",
    width: 3456,
    height: 1988,
  },
  {
    src: "/product-screenshots/landing-stats.png",
    alt: "Pathway stats page showing recruiting metrics and Sankey flow",
    title: "Stats",
    width: 3456,
    height: 1988,
  },
  {
    src: "/product-screenshots/landing-detail.png",
    alt: "Pathway application detail panel with timeline, details, and event controls",
    title: "Application detail",
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

      <section className="landing-hero mx-auto w-full max-w-7xl px-5 pb-12 pt-14 sm:px-8 lg:px-12">
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="landing-hero-title max-w-6xl text-[3.65rem] text-foreground sm:text-[5.15rem] lg:text-[7.35rem]">
            <span>Find roles faster.</span>
            <span>Track every application.</span>
          </h1>
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
        <LandingScrollCue />
      </section>

      <section id="product" className="mx-auto w-full max-w-[88rem] px-5 pb-24 sm:px-8 lg:px-12">
        <LandingProductStory shots={PRODUCT_SHOTS} />
      </section>
    </main>
  );
}
