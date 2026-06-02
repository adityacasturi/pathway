export function hasAnyInteraction(
  interactions: ReadonlySet<string>,
  interactionIds: readonly string[],
): boolean {
  return interactionIds.some((id) => interactions.has(id));
}

export function applyInteractionIds(
  current: ReadonlySet<string>,
  interactionIds: readonly string[],
  next: boolean,
): Set<string> {
  const out = new Set(current);
  for (const id of interactionIds) {
    if (next) out.add(id);
    else out.delete(id);
  }
  return out;
}
