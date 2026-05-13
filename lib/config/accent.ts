export const ACCENT_OPTIONS = [
  {
    id: "midnight",
    label: "Midnight",
    swatch: "oklch(0.3 0.045 270)",
  },
  {
    id: "sage",
    label: "Sage",
    swatch: "oklch(0.52 0.055 150)",
  },
  {
    id: "sky",
    label: "Sky",
    swatch: "oklch(0.54 0.06 245)",
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "oklch(0.47 0.075 20)",
  },
] as const;

export type AccentColor = (typeof ACCENT_OPTIONS)[number]["id"];

export const DEFAULT_ACCENT_COLOR: AccentColor = "sage";

const LEGACY_ACCENT_ALIASES: Record<string, AccentColor> = {
  powder: "sky",
  "powder-blue": "sky",
  rosewood: "rose",
  "dusty-plum": "rose",
  clay: "rose",
  slate: "midnight",
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
