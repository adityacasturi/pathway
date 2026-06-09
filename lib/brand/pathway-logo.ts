/** Black wordmark on transparent. */
export const PATHWAY_LOGO_SRC = "/brand/pathway-logo-black-transparent-600w.png";

export function pathwayLogoImageClass(className?: string): string {
  return ["pathway-logo", className].filter(Boolean).join(" ");
}
