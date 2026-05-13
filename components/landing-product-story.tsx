"use client";

import Image from "next/image";
import { motion, type Variants } from "framer-motion";

type ProductShot = {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  width: number;
  height: number;
};

const landingEase = [0.16, 1, 0.3, 1] as const;

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 42, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.76, delay: 0.16, ease: landingEase },
  },
};

const copyVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, delay: 0.26, ease: landingEase },
  },
};

export function LandingProductStory({ shots }: { shots: readonly ProductShot[] }) {
  return (
    <>
      {shots.map((shot, index) => (
        <motion.section
          key={shot.src}
          className={`landing-feature ${index % 2 === 1 ? "landing-feature-reverse" : ""} ${
            shot.src.includes("detail") ? "landing-feature-detail" : ""
          }`}
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.18, margin: "0px 0px -12% 0px" }}
        >
          <motion.div
            className={`landing-product-frame landing-feature-frame ${
              shot.src.includes("detail") ? "landing-detail-frame" : ""
            }`}
            variants={sectionVariants}
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
          <motion.div className="landing-feature-copy" variants={copyVariants}>
            <span className="label-micro">{shot.eyebrow}</span>
            <h2 className="mt-3 display-serif text-[2.1rem] leading-none text-foreground sm:text-[2.75rem]">
              {shot.title}
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              {shot.body}
            </p>
          </motion.div>
        </motion.section>
      ))}
    </>
  );
}
