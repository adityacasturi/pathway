import type { LandingTerminalRole, LandingTerminalSnapshot } from "@/lib/landing/terminal-types";

const FALLBACK_ROLES: LandingTerminalRole[] = [
  {
    timeLabel: "02:14",
    company: "OpenAI",
    role: "Software Engineering Intern",
  },
  {
    timeLabel: "01:52",
    company: "Stripe",
    role: "Software Engineer Intern",
  },
  {
    timeLabel: "01:38",
    company: "Jane Street",
    role: "Software Engineering Intern",
  },
  {
    timeLabel: "01:09",
    company: "NVIDIA",
    role: "Deep Learning Intern",
  },
  {
    timeLabel: "00:47",
    company: "Databricks",
    role: "Software Engineering Intern",
  },
];

export const LANDING_TERMINAL_FALLBACK: LandingTerminalSnapshot = {
  roleCount: 184,
  recentRoles: FALLBACK_ROLES,
  source: "fallback",
};
