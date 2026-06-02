import { htmlToPlainText } from "./plain-text.ts";

/** Decode entities and strip tags for Avature/BrassRing HTML snippets. */
export function decodeHtmlEntities(value: string): string {
  return htmlToPlainText(value);
}

/** Alias used by adapters that previously inlined tag stripping. */
export function stripHtml(value: string): string {
  return htmlToPlainText(value);
}

/** BrassRing field values use the same entity encoding as generic HTML snippets. */
export function decodeBrassRingEntities(value: string): string {
  return decodeHtmlEntities(value);
}

/** Apple careers detail URLs use a slugified posting title segment. */
export function slugifyPostingTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "role";
}
