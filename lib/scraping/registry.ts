import { createAshbyAdapter } from "./adapters/ashby.ts";
import { createGreenhouseAdapter } from "./adapters/greenhouse.ts";
import { createLeverAdapter } from "./adapters/lever.ts";
import { amazonAdapter } from "./adapters/amazon.ts";
import { janeStreetAdapter } from "./adapters/jane-street.ts";
import { nvidiaAdapter } from "./adapters/nvidia.ts";
import type { ScrapeAdapter, ScrapeSourceConfig } from "./types.ts";

/** Custom adapters keyed by `company_sources.adapter_key`. */
export const CUSTOM_ADAPTER_REGISTRY = new Map<string, ScrapeAdapter>([
  ["jane-street-custom", janeStreetAdapter],
  ["amazon-jobs", amazonAdapter],
  ["nvidia-eightfold", nvidiaAdapter],
]);

export function buildScrapeAdapter(source: ScrapeSourceConfig): ScrapeAdapter | null {
  if (source.sourceType === "custom") {
    const custom = CUSTOM_ADAPTER_REGISTRY.get(source.adapterKey);
    if (!custom) return null;
    return { ...custom, source };
  }

  if (source.sourceType === "greenhouse") {
    return createGreenhouseAdapter(source);
  }
  if (source.sourceType === "lever") {
    return createLeverAdapter(source);
  }
  if (source.sourceType === "ashby") {
    return createAshbyAdapter(source);
  }

  return null;
}
