"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  HERO_KINETIC_COMPANIES,
  type HeroKineticCompany,
} from "@/lib/landing/hero-kinetic-companies";
import { companyLogoStaticUrl } from "@/lib/logo/static";
import { cn } from "@/lib/utils";

const HOLD_MS = 2600;
const WIDTH_SLACK_PX = 12;

function KineticCompanyMark({ company }: { company: HeroKineticCompany }) {
  return (
    <>
      <Image
        src={companyLogoStaticUrl(company.slug)}
        alt=""
        width={48}
        height={48}
        className="mkt-hero-kinetic-logo"
        aria-hidden
      />
      <span className="mkt-hero-kinetic-name">{company.name}</span>
    </>
  );
}

export function HeroKineticHeadline({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const [index, setIndex] = useState(0);
  const [slideEnabled, setSlideEnabled] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [kineticWidth, setKineticWidth] = useState<number | null>(null);
  const sizerRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const indexRef = useRef(index);

  const trackCompanies = [...HERO_KINETIC_COMPANIES, HERO_KINETIC_COMPANIES[0]];

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useLayoutEffect(() => {
    const measure = () => {
      const widths = sizerRefs.current.map((element) => element?.getBoundingClientRect().width ?? 0);
      const maxWidth = Math.max(...widths, 0);
      if (maxWidth > 0) {
        setKineticWidth(maxWidth + WIDTH_SLACK_PX);
      }
    };

    measure();
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      const current = indexRef.current;
      if (current >= HERO_KINETIC_COMPANIES.length) return;

      setIndex((current) => (current >= HERO_KINETIC_COMPANIES.length ? current : current + 1));
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const handleTrackTransitionEnd = () => {
    if (index >= HERO_KINETIC_COMPANIES.length) {
      setSlideEnabled(false);
      setIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSlideEnabled(true));
      });
      return;
    }
  };

  return (
    <h1 id="mkt-hero-title" className={cn("mkt-hero-title", className)} style={style}>
      <span className="sr-only">Land your dream internship at top companies.</span>

      <span className="mkt-hero-line" aria-hidden>
        <span className="mkt-hero-copy">
          <span className="mkt-hero-copy-mobile">
            <span className="mkt-hero-copy-line">Land your dream</span>
            <span className="mkt-hero-copy-line">internship at</span>
          </span>
          <span className="mkt-hero-copy-desktop">Land your dream internship at</span>
        </span>
        <span
          className="mkt-hero-kinetic"
          style={{ width: kineticWidth ? `${kineticWidth}px` : undefined }}
        >
          <span className="mkt-hero-kinetic-sizer">
            {HERO_KINETIC_COMPANIES.map((company, companyIndex) => (
              <span
                key={`sizer-${company.slug}`}
                ref={(element) => {
                  sizerRefs.current[companyIndex] = element;
                }}
                className="mkt-hero-kinetic-step"
              >
                <KineticCompanyMark company={company} />
              </span>
            ))}
          </span>
          <span className="mkt-hero-kinetic-window">
            <span
              className={cn("mkt-hero-kinetic-track", slideEnabled && "mkt-hero-kinetic-track--slide")}
              style={{ transform: `translateY(calc(-1 * ${index} * var(--mkt-kinetic-step)))` }}
              onTransitionEnd={handleTrackTransitionEnd}
            >
              {trackCompanies.map((company, stepIndex) => (
                <span key={`${company.slug}-${stepIndex}`} className="mkt-hero-kinetic-step">
                  <KineticCompanyMark company={company} />
                </span>
              ))}
            </span>
          </span>
        </span>
      </span>
    </h1>
  );
}
