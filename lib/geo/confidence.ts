import type { LocationConfidence, ResolvedPlace } from "./types.ts";

export function scoreFromProvider(
  provider: ResolvedPlace["provider"],
  hasGazetteerHit: boolean,
): LocationConfidence {
  switch (provider) {
    case "structured":
      return 95;
    case "cache":
      return 90;
    case "gazetteer":
      return hasGazetteerHit ? 88 : 75;
    case "parser":
      return 72;
    case "manual":
      return 100;
    default:
      return 50;
  }
}

export function minConfidence(places: readonly { confidence: LocationConfidence }[]): LocationConfidence {
  if (places.length === 0) return 0;
  return Math.min(...places.map((p) => p.confidence));
}
