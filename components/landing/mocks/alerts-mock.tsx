"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Plus, X } from "lucide-react";
import { MockLogo, MockScreen, mockEase, useSceneInView } from "@/components/landing/mocks/shared";
import { cn } from "@/lib/utils";

const COMPANY_ALERTS = ["Jane Street", "Citadel", "Nvidia", "Stripe"];

const FAN_ROTATIONS = [-5, -2, 2, 4, -1, 3] as const;

type Sector = {
  slug: string;
  label: string;
  description: string;
  companies: string[];
};

const SECTORS: Sector[] = [
  {
    slug: "faang",
    label: "FAANG+",
    description: "Meta, Apple, Amazon, Netflix, Google, Microsoft",
    companies: ["Meta", "Apple", "Amazon", "Netflix", "Google", "Microsoft"],
  },
  {
    slug: "quant",
    label: "Quant",
    description: "Jane Street, Citadel, HRT, Two Sigma, and peers",
    companies: ["Jane Street", "Citadel", "Hudson River Trading", "Two Sigma"],
  },
];

function MiniLogoStack({ companies }: { companies: string[] }) {
  const size = 22;
  const frame = size + 6;
  const overlap = 9;
  const step = frame - overlap;
  return (
    <div className="relative shrink-0" style={{ width: frame + step * (companies.length - 1), height: frame + 4 }} aria-hidden>
      {companies.map((company, i) => (
        <div
          key={company}
          className="absolute top-1/2"
          style={{
            left: i * step,
            zIndex: companies.length - i,
            transform: `translateY(-50%) rotate(${FAN_ROTATIONS[i % FAN_ROTATIONS.length]}deg)`,
          }}
        >
          <div
            className="flex items-center justify-center rounded-md bg-card ring-2 ring-card shadow-[0_4px_10px_-6px_color-mix(in_oklab,var(--ink)_40%,transparent),0_0_0_1px_color-mix(in_oklab,var(--ink)_8%,transparent)]"
            style={{ width: frame, height: frame }}
          >
            <MockLogo company={company} size={size} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectorCard({ sector, active }: { sector: Sector; active: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border px-3.5 py-3.5 transition-[border-color,background-color,box-shadow] duration-300",
        active
          ? "border-[color:color-mix(in_oklab,var(--primary)_35%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
          : "border-border bg-card",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <MiniLogoStack companies={sector.companies} />
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
            active ? "text-[color:var(--primary)]" : "text-muted-foreground",
          )}
          aria-hidden
        >
          {active ? <Check size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
        </span>
      </div>
      <p className="text-[14px] font-medium tracking-tight text-foreground">{sector.label}</p>
      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{sector.description}</p>
    </div>
  );
}

export function AlertsMock() {
  const { ref, active, reduced } = useSceneInView<HTMLDivElement>(0.55);
  // The FAANG+ sector starts following once the panel settles into view.
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!active || reduced) return;
    const follow = setTimeout(() => setFollowing(true), 1500);
    return () => clearTimeout(follow);
  }, [active, reduced]);

  const faangActive = active && (reduced || following);

  return (
    <MockScreen label="Alerts">
      <div ref={ref} className="flex h-full flex-col gap-4">
        {/* Instant alerts toggle */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium tracking-tight text-foreground">Instant alerts</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Email the moment a new role posts at anything you follow.
            </p>
          </div>
          <span
            className="relative h-6 w-11 shrink-0 rounded-full border border-[color:var(--primary)]"
            style={{ background: "var(--primary)" }}
            aria-hidden
          >
            <span className="absolute top-1/2 left-0.5 size-5 -translate-y-1/2 translate-x-5 rounded-full bg-white shadow-sm" />
          </span>
        </div>

        {/* Company alerts */}
        <div>
          <p className="label-meta mb-2">Companies</p>
          <ul className="flex flex-wrap gap-2">
            {COMPANY_ALERTS.map((company, i) => (
              <motion.li
                key={company}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={active ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.09, ease: mockEase.out }}
              >
                <span className="inline-flex items-center rounded-full border border-[color:color-mix(in_oklab,var(--primary)_35%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_7%,var(--card))] py-1 pr-1.5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_12%,transparent)]">
                  <span className="flex min-w-0 items-center gap-2 pl-3 pr-1">
                    <MockLogo company={company} size={22} />
                    <span className="truncate text-[13px] font-medium text-foreground">{company}</span>
                  </span>
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground">
                    <X size={11} strokeWidth={1.75} />
                  </span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Curated sectors */}
        <div className="min-h-0 flex-1">
          <p className="label-meta mb-2">Curated sectors</p>
          <ul className="grid grid-cols-2 gap-2">
            {SECTORS.map((sector, i) => (
              <motion.li
                key={sector.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.45, delay: 0.7 + i * 0.1, ease: mockEase.out }}
                className="h-full"
              >
                <SectorCard sector={sector} active={sector.slug === "faang" ? faangActive : sector.slug === "quant"} />
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </MockScreen>
  );
}
