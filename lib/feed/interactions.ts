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

export function resolveInteractionSet(
  baseIds: Iterable<string>,
  overrides: ReadonlyMap<string, boolean>,
): Set<string> {
  const out = new Set(baseIds);
  for (const [id, enabled] of overrides) {
    if (enabled) out.add(id);
    else out.delete(id);
  }
  return out;
}

export function applyInteractionOverride(
  current: ReadonlyMap<string, boolean>,
  interactionIds: readonly string[],
  next: boolean,
): Map<string, boolean> {
  const out = new Map(current);
  for (const id of interactionIds) {
    out.set(id, next);
  }
  return out;
}
