"use client";

import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type CompanyCard = {
  name: string;
  context: string;
  location: string;
  logoSrc: string;
};

const COMPANIES: CompanyCard[] = [
  { name: "OpenAI", context: "Applied AI", location: "San Francisco", logoSrc: "/company-logos/openai.png" },
  { name: "Stripe", context: "Payments Infra", location: "New York", logoSrc: "/company-logos/stripe.png" },
  { name: "NVIDIA", context: "GPU Systems", location: "Santa Clara", logoSrc: "/company-logos/nvidia.png" },
  { name: "Google", context: "Search Infra", location: "Mountain View", logoSrc: "/company-logos/google.png" },
  { name: "Amazon", context: "Cloud Scale", location: "Seattle", logoSrc: "/company-logos/amazon.png" },
  { name: "Jane Street", context: "Quant Dev", location: "New York", logoSrc: "/company-logos/jane-street.png" },
  { name: "Apple", context: "Product Systems", location: "Cupertino", logoSrc: "/company-logos/apple.png" },
  { name: "Microsoft", context: "Platform AI", location: "Redmond", logoSrc: "/company-logos/microsoft.png" },
  { name: "Anthropic", context: "Model Safety", location: "San Francisco", logoSrc: "/company-logos/anthropic.png" },
  { name: "SpaceX", context: "Flight Software", location: "Hawthorne", logoSrc: "/company-logos/spacex.png" },
];

const DESK_POSITIONS = [
  { x: -176, y: -124, rotate: -8 },
  { x: 36, y: -142, rotate: 5 },
  { x: 188, y: -74, rotate: 12 },
  { x: -74, y: -34, rotate: 4 },
  { x: 108, y: -8, rotate: -7 },
  { x: -188, y: 88, rotate: 9 },
  { x: -18, y: 96, rotate: -3 },
  { x: 174, y: 104, rotate: 7 },
  { x: -112, y: 214, rotate: -10 },
  { x: 94, y: 206, rotate: 11 },
];

const cardVariants: Variants = {
  visible: (index: number) => ({
    x: DESK_POSITIONS[index]?.x ?? 0,
    y: DESK_POSITIONS[index]?.y ?? 0,
    rotate: DESK_POSITIONS[index]?.rotate ?? 0,
    scale: 1,
    transition: {
      duration: 0.64,
      ease: [0.16, 1, 0.3, 1],
      delay: index * 0.035,
    },
  }),
};

export function HeroCompanyCardFan() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      aria-label="Decorative recruiting desk of prestige company notes"
      className="relative mx-auto flex min-h-[25rem] w-full max-w-[38rem] items-center justify-center overflow-visible py-10 sm:min-h-[31rem] lg:min-h-[35rem] lg:max-w-none lg:-translate-y-10 lg:translate-x-10 lg:justify-end"
    >
      <motion.ul
        aria-hidden="true"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-[19rem] w-[18rem] scale-[0.72] sm:h-[25rem] sm:w-[31rem] sm:scale-100 lg:h-[28rem] lg:w-[35rem]"
      >
        <span className="pointer-events-none absolute -inset-x-10 bottom-2 h-20 rounded-[999px] bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] blur-2xl" />
        <span className="pointer-events-none absolute left-[8%] top-[12%] h-28 w-28 rounded-[8px] border border-[color-mix(in_oklab,var(--primary)_20%,var(--rule))] bg-[color-mix(in_oklab,var(--card)_68%,var(--primary)_8%)] opacity-55 shadow-[0_18px_40px_-34px_color-mix(in_oklab,var(--primary)_46%,transparent)]" />
        <span className="pointer-events-none absolute bottom-[8%] right-[8%] h-24 w-36 rotate-[-6deg] rounded-[8px] border border-[color-mix(in_oklab,var(--primary)_18%,var(--rule))] bg-[color-mix(in_oklab,var(--card)_70%,var(--primary)_7%)] opacity-45" />
        {COMPANIES.map((company, index) => (
          <motion.li
            key={company.name}
            custom={index}
            variants={cardVariants}
            initial={false}
            animate="visible"
            whileHover={
              prefersReducedMotion
                ? undefined
                : {
                    scale: 1.035,
                    y: (DESK_POSITIONS[index]?.y ?? 0) - 14,
                    rotate: (DESK_POSITIONS[index]?.rotate ?? 0) * 0.35,
                    zIndex: 80,
                    transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
                  }
            }
            className="absolute left-1/2 top-1/2 block h-[8.1rem] w-[15rem] origin-center -translate-x-1/2 -translate-y-1/2 will-change-transform rounded-[8px] border border-[color-mix(in_oklab,var(--rule-strong)_78%,white_22%)] text-left shadow-[0_18px_46px_-34px_color-mix(in_oklab,var(--ink)_60%,transparent)] sm:h-[9rem] sm:w-[17rem] lg:h-[9.45rem] lg:w-[18rem]"
            style={{
              zIndex: index + 1,
              background:
                "linear-gradient(180deg, color-mix(in oklab, white 70%, transparent), transparent 42%), var(--card)",
            }}
          >
            <span
              className="relative flex h-full flex-col overflow-hidden rounded-[5px] border bg-[color-mix(in_oklab,var(--paper)_92%,white_8%)] p-3"
              style={{
                borderColor: "color-mix(in oklab, var(--primary) 20%, var(--rule) 80%)",
              }}
            >
              <span
                className="absolute left-0 top-0 h-1 w-full bg-[var(--primary)]"
              />
              <span className="mb-3 flex justify-end font-mono text-[9px] uppercase text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[7px] border bg-white shadow-[0_1px_0_color-mix(in_oklab,white_80%,transparent)_inset] sm:h-16 sm:w-16"
                  style={{
                    borderColor: "color-mix(in oklab, var(--rule) 78%, white 22%)",
                  }}
                >
                  <Image
                    src={company.logoSrc}
                    alt={`${company.name} logo`}
                    width={44}
                    height={44}
                    sizes="44px"
                    className="rounded-sm object-contain"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-[1.18rem] font-medium leading-none text-foreground sm:text-[1.34rem]">
                    {company.name}
                  </span>
                  <span className="mt-2 block font-mono text-[9px] uppercase leading-none tracking-[0.1em] text-muted-foreground">
                    {company.context}
                  </span>
                </span>
              </span>
              <span className="mt-3 h-px w-full bg-[color-mix(in_oklab,var(--primary)_22%,var(--rule))]" />
              <span className="mt-2 flex justify-between gap-3 font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">
                <span>{company.location}</span>
                <span className="text-[color-mix(in_oklab,var(--primary)_78%,var(--muted-foreground))]">{company.context}</span>
              </span>
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
