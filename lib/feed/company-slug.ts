/** Parse `company:<slug>` from scraped feed `sourceId`. */
export function parseCompanySlugFromSourceId(sourceId: string): string | null {
  if (!sourceId.startsWith("company:")) return null;
  const slug = sourceId.slice("company:".length).trim();
  return slug || null;
}
