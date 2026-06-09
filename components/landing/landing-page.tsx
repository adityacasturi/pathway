import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingHeadline } from "@/components/landing/landing-headline";
import { SchoolLogoGrid } from "@/components/landing/school-logo-grid";
import { LANDING_TIMING_STYLE } from "@/lib/landing/entrance-timing";
import "./statement.css";

export function LandingPage() {
  return (
    <main
      className="landing-statement"
      style={LANDING_TIMING_STYLE as CSSProperties}
    >
      <section className="landing-statement__stage" aria-labelledby="landing-statement">
        <Link href="/" aria-label="Pathway home" className="landing-statement__brand">
          <Image
            src="/brand/pathway-logo-black-transparent-600w.png"
            alt="Pathway"
            width={600}
            height={148}
            priority
            className="brand-wordmark h-12 w-auto sm:h-14"
          />
        </Link>

        <LandingHeadline />

        <div className="landing-statement__cta">
          <Link href="/register" className="lp-cta lp-cta--primary">
            Get started <ArrowRight size={15} strokeWidth={1.9} />
          </Link>
          <p className="landing-statement__signin">
            Already on Pathway? <Link href="/login">Sign in</Link>
          </p>
        </div>

        <div className="landing-statement__schools" aria-label="Universities using Pathway">
          <p className="landing-statement__schools-label">Trusted by students at</p>
          <SchoolLogoGrid />
        </div>
      </section>
    </main>
  );
}
