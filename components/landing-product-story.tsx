"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { OpeningsFeedMock } from "@/components/landing/mocks/openings-feed-mock";
import { OverviewMock } from "@/components/landing/mocks/overview-mock";
import { ApplicationsMock } from "@/components/landing/mocks/applications-mock";
import { CompaniesMock } from "@/components/landing/mocks/companies-mock";
import { InsightsMock } from "@/components/landing/mocks/insights-mock";
import { AlertsMock } from "@/components/landing/mocks/alerts-mock";

const landingEase = [0.16, 1, 0.3, 1] as const;

type Scene = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  render: () => ReactNode;
};

const SCENES: Scene[] = [
  {
    key: "openings",
    eyebrow: "Openings",
    title: "New roles, the second they post.",
    body: "We watch 400+ career pages around the clock. New internships stream into your feed the moment they post, ready to track, save, or dismiss in a click.",
    render: () => <OpeningsFeedMock variant="wide" />,
  },
  {
    key: "overview",
    eyebrow: "Overview",
    title: "Your whole search, at a glance.",
    body: "Fresh openings, your pipeline, and what needs attention, all the moment you land on the page.",
    render: () => <OverviewMock />,
  },
  {
    key: "applications",
    eyebrow: "Tracker",
    title: "Every application, one clean board.",
    body: "Status updates itself from the events you log. Watch an interview become an offer without touching a dropdown.",
    render: () => <ApplicationsMock />,
  },
  {
    key: "companies",
    eyebrow: "Companies",
    title: "400+ companies, always watched.",
    body: "See who's hiring right now, how many roles are open, and star the teams you're chasing.",
    render: () => <CompaniesMock />,
  },
  {
    key: "insights",
    eyebrow: "Insights",
    title: "Know exactly where you stand.",
    body: "Response, interview, and offer rates, plus the companies posting the most roles this week.",
    render: () => <InsightsMock />,
  },
  {
    key: "alerts",
    eyebrow: "Alerts",
    title: "Get pinged the second they post.",
    body: "Set instant alerts for the companies you're chasing, or follow a whole curated sector like FAANG+ or Quant in a single tap.",
    render: () => <AlertsMock />,
  },
];

const frameVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.75, ease: landingEase },
  },
};

const copyVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.1, ease: landingEase },
  },
};

export function LandingProductStory() {
  return (
    <>
      {SCENES.map((scene, index) => (
        <motion.section
          key={scene.key}
          className={`landing-feature ${index % 2 === 1 ? "landing-feature-reverse" : ""}`}
          initial="hidden"
          whileInView="visible"
          viewport={{ amount: 0.25, margin: "0px 0px -10% 0px" }}
        >
          <motion.div className="landing-feature-frame landing-product-frame" variants={frameVariants}>
            {scene.render()}
          </motion.div>
          <motion.div className="landing-feature-copy" variants={copyVariants}>
            <span className="label-micro">{scene.eyebrow}</span>
            <h2 className="display-serif mt-4 text-[2rem] leading-[1.05] text-foreground sm:text-[2.5rem]">
              {scene.title}
            </h2>
            <p className="lp-section-sub mt-5">{scene.body}</p>
          </motion.div>
        </motion.section>
      ))}
    </>
  );
}
