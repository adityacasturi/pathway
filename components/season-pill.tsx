type Season = "Summer" | "Fall";

/*
 * Season marker — compact, warm metadata that stays easy to skim in dense
 * rows. Summer gets a sun-tinted amber; Fall gets an autumn rust instead of
 * the previous cool grey-ish read.
 */
export function SeasonPill({ season }: { season: Season }) {
  const color =
    season === "Summer"
      ? "oklch(0.54 0.14 78)"
      : "oklch(0.56 0.15 48)";
  return (
    <span
      className="inline-flex items-center rounded-[4px] px-1.5 py-[1px] font-mono text-[9px] font-medium tracking-[0.16em] uppercase"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 8%, transparent)`,
      }}
    >
      {season}
    </span>
  );
}
