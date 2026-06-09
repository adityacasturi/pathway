export function buildPostingListTitle(totalCount: number): string {
  return `${totalCount} opening${totalCount === 1 ? "" : "s"}`;
}
