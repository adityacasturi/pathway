export type LandingTerminalRole = {
  timeLabel: string;
  company: string;
  role: string;
};

export type LandingTerminalSnapshot = {
  roleCount: number;
  recentRoles: LandingTerminalRole[];
  source: "live" | "fallback";
};
