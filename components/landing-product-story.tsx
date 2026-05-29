"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";

type ProductShot = {
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
};

const landingEase = [0.16, 1, 0.3, 1] as const;

const sectionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 42,
    scale: 0.985,
    transition: { duration: 0.6, delay: 0.18, ease: landingEase },
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.76, delay: 0.18, ease: landingEase },
  },
};

// The first product image is the closest to the hero, so when it scrolls back
// up the user is essentially leaving the page — no delay on hide so it feels
// responsive against the scroll.
const firstSectionVariants: Variants = {
  ...sectionVariants,
  hidden: {
    ...sectionVariants.hidden,
    transition: { duration: 0.45, delay: 0, ease: landingEase },
  },
};

const copyVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
    transition: { duration: 0.5, delay: 0.24, ease: landingEase },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, delay: 0.28, ease: landingEase },
  },
};

const firstCopyVariants: Variants = {
  ...copyVariants,
  hidden: {
    ...copyVariants.hidden,
    transition: { duration: 0.4, delay: 0, ease: landingEase },
  },
};

export function LandingProductStory({ shots }: { shots: readonly ProductShot[] }) {
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [visible, setVisible] = useState<boolean[]>(() => shots.map(() => false));

  useEffect(() => {
    let frame: number | null = null;
    const compute = () => {
      frame = null;
      const viewportHeight = window.innerHeight;
      // Sections flip to "visible" once their top crosses this fraction of the
      // viewport from the bottom. The first section uses a lower fraction so
      // it hides as the hero comes back into view, instead of getting pinned
      // by the page's top boundary.
      const next = sectionRefs.current.map((el, index) => {
        if (!el) return false;
        const ratio = index === 0 ? 0.7 : 0.82;
        return el.getBoundingClientRect().top < viewportHeight * ratio;
      });
      setVisible((prev) => {
        if (
          prev.length === next.length &&
          prev.every((value, index) => value === next[index])
        ) {
          return prev;
        }
        return next;
      });
    };
    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [shots.length]);

  return (
    <>
      {shots.map((shot, index) => {
        const isFirst = index === 0;
        const sectionVariantsForIndex = isFirst ? firstSectionVariants : sectionVariants;
        const copyVariantsForIndex = isFirst ? firstCopyVariants : copyVariants;
        return (
        <motion.section
          key={shot.src}
          ref={(el) => {
            sectionRefs.current[index] = el;
          }}
          className={`landing-feature ${index % 2 === 1 ? "landing-feature-reverse" : ""} ${
            shot.src.includes("detail") ? "landing-feature-detail" : ""
          }`}
          variants={sectionVariantsForIndex}
          initial="hidden"
          animate={visible[index] ? "visible" : "hidden"}
        >
          <motion.div
            className={`landing-product-frame landing-feature-frame ${
              shot.src.includes("detail") ? "landing-detail-frame" : ""
            }`}
            variants={sectionVariantsForIndex}
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              width={shot.width}
              height={shot.height}
              preload={index === 0}
              loading={index === 0 ? undefined : "lazy"}
              sizes="(max-width: 1024px) 100vw, 920px"
              className="landing-feature-image"
            />
          </motion.div>
          <motion.div className="landing-feature-copy" variants={copyVariantsForIndex}>
            <h2 className="display-serif text-[2.1rem] leading-none text-foreground sm:text-[2.75rem]">
              {shot.title}
            </h2>
          </motion.div>
        </motion.section>
        );
      })}
    </>
  );
}
