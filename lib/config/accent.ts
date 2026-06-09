export const ACCENT_OPTIONS = [
  {
    id: "midnight",
    label: "Midnight",
    swatch: "oklch(0.18 0.01 265)",
  },
  {
    id: "indigo",
    label: "Indigo",
    swatch: "oklch(0.43 0.09 262)",
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "oklch(0.47 0.075 20)",
  },
] as const;

export type AccentColor = (typeof ACCENT_OPTIONS)[number]["id"];

export const DEFAULT_ACCENT_COLOR: AccentColor = "midnight";

const LEGACY_ACCENT_ALIASES: Record<string, AccentColor> = {
  powder: "indigo",
  "powder-blue": "indigo",
  sky: "indigo",
  rosewood: "rose",
  "dusty-plum": "rose",
  clay: "rose",
  slate: "midnight",
  sage: "midnight",
};

export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === "string" && ACCENT_OPTIONS.some((option) => option.id === value);
}

export function resolveAccentColor(value: unknown): AccentColor {
  if (isAccentColor(value)) return value;
  if (typeof value === "string" && value in LEGACY_ACCENT_ALIASES) {
    return LEGACY_ACCENT_ALIASES[value];
  }
  return DEFAULT_ACCENT_COLOR;
}
