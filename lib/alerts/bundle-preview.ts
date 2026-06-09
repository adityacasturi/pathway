const DEFAULT_MAX_NAMES = 3;

/** One-line bundle subtitle: "Waymo, Zoox, Aurora +3 more". */
export function formatBundleCompanyLine(
  companies: ReadonlyArray<{ name: string }>,
  maxNames = DEFAULT_MAX_NAMES,
): string {
  if (companies.length === 0) {
    return "";
  }

  const names = companies.map((company) => company.name);
  if (names.length <= maxNames) {
    return names.join(", ");
  }

  const visible = names.slice(0, maxNames);
  const remaining = names.length - maxNames;
  return `${visible.join(", ")} +${remaining} more`;
}
