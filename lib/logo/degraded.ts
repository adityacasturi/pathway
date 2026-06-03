const DEGRADED_KEY = Symbol.for("internship-tracker.logo-dev-degraded");

type DegradedState = {
  until: number;
  reason: string;
};

const DEFAULT_DEGRADED_MS = 5 * 60_000;

function getState(): DegradedState | null {
  return (
    globalThis as typeof globalThis & { [DEGRADED_KEY]?: DegradedState | null }
  )[DEGRADED_KEY] ?? null;
}

function setState(state: DegradedState | null): void {
  (
    globalThis as typeof globalThis & { [DEGRADED_KEY]?: DegradedState | null }
  )[DEGRADED_KEY] = state;
}

export function isLogoDevDegraded(now = Date.now()): boolean {
  const state = getState();
  if (!state) return false;
  if (state.until <= now) {
    setState(null);
    return false;
  }
  return true;
}

export function markLogoDevDegraded(
  reason: string,
  durationMs = DEFAULT_DEGRADED_MS,
  now = Date.now(),
): void {
  setState({ until: now + durationMs, reason });
}

export function logoDevDegradedReason(): string | null {
  const state = getState();
  if (!state || state.until <= Date.now()) return null;
  return state.reason;
}

export function shouldOpenLogoDevCircuit(upstreamStatus: number): boolean {
  return upstreamStatus === 401 || upstreamStatus === 403 || upstreamStatus === 429;
}

/** @internal Test helper */
export function resetLogoDevDegradedForTests(): void {
  setState(null);
}
