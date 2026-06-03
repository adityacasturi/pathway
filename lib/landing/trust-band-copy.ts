export type TrustBandRolePair = {
  role: string;
  company: string;
};

/**
 * Curated pairs for "Land your dream internship as a [role] at [company]."
 * All roles take article "a". Each role and company appears once.
 */
export const TRUST_BAND_ROLE_PAIRS: TrustBandRolePair[] = [
  { role: "quant trader", company: "Jane Street" },
  { role: "software engineer", company: "Stripe" },
  { role: "research fellow", company: "Databricks" },
  { role: "data scientist", company: "Two Sigma" },
];

export function formatTrustBandPair(pair: TrustBandRolePair): string {
  return `${pair.role} at ${pair.company}`;
}

export const TRUST_BAND_ROLE_MAX_CH = Math.max(
  ...TRUST_BAND_ROLE_PAIRS.map((pair) => pair.role.length),
);

export const TRUST_BAND_COMPANY_MAX_CH = Math.max(
  ...TRUST_BAND_ROLE_PAIRS.map((pair) => pair.company.length),
);

export const TRUST_BAND_HEADLINE_STATIC =
  "Land your dream internship as a software engineer at companies Pathway watches.";
