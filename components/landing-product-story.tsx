"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { OpeningsFeedMock } from "@/components/landing/mocks/openings-feed-mock";
import { OverviewMock } from "@/components/landing/mocks/overview-mock";
import { ApplicationsMock } from "@/components/landing/mocks/applications-mock";
import { CompaniesMock } from "@/components/landing/mocks/companies-mock";
import { InsightsMock } from "@/components/landing/mocks/insights-mock";
import { AlertsMock } from "@/components/landing/mocks/alerts-mock";
import { OfferTimelineMock } from "@/components/landing/mocks/offer-timeline-mock";

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
    body: "Pathway scans career pages every 15 minutes, pulls fresh internships into one feed, and lets you save, dismiss, or start tracking before everyone else sees the link.",
    render: () => <OpeningsFeedMock variant="wide" />,
  },
  {
    key: "alerts",
    eyebrow: "Alerts",
    title: "Get pinged the second they post.",
    body: "Follow the companies and sectors you care about, then let instant alerts bring the right roles to you while they are still fresh.",
    render: () => <AlertsMock />,
  },
  {
    key: "applications",
    eyebrow: "Tracker",
    title: "Every application, one clean board.",
    body: "Track every role from applied to offer in a board built for speed: clean statuses, quick edits, and the next step always visible.",
    render: () => <ApplicationsMock />,
  },
  {
    key: "overview",
    eyebrow: "Overview",
    title: "Your whole search, at a glance.",
    body: "Open the dashboard and see what is new, what is moving, and what needs attention without digging through tabs or stale spreadsheets.",
    render: () => <OverviewMock />,
  },
  {
    key: "insights",
    eyebrow: "Insights",
    title: "Know exactly where you stand.",
    body: "Turn your search into signal: response rates, interview momentum, offer progress, and the companies posting the most right now.",
    render: () => <InsightsMock />,
  },
  {
    key: "companies",
    eyebrow: "Companies",
    title: "400+ companies, always watched.",
    body: "Browse the companies Pathway watches, spot who is actively hiring, and star the teams you want surfaced first.",
    render: () => <CompaniesMock />,
  },
  {
    key: "offer",
    eyebrow: "Timeline",
    title: "From application to offer.",
    body: "Every update becomes a readable timeline, so you can walk into the next round knowing the exact history, notes, and outcome for that role.",
    render: () => <OfferTimelineMock />,
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
          id={index === 0 ? "product" : undefined}
          className={`landing-feature ${index % 2 === 1 ? "landing-feature-reverse" : ""}`}
          initial={index === 0 ? false : "hidden"}
          animate={index === 0 ? "visible" : undefined}
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
