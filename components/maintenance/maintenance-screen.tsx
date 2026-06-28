import { Instrument_Serif } from "next/font/google";
import { PathwayLogo } from "@/components/brand/pathway-logo";
import { Surface } from "@/components/design-system/surface";
import { MaintenanceRefreshButton } from "@/components/maintenance/maintenance-refresh-button";
import { cn } from "@/lib/utils";

const maintenanceDisplay = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-maintenance-display",
  display: "swap",
});

export function MaintenanceScreen() {
  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden bg-background",
        maintenanceDisplay.variable,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] bg-[linear-gradient(to_right,color-mix(in_oklab,var(--border)_55%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--border)_55%,transparent)_1px,transparent_1px)] bg-size-[3.5rem_3.5rem] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />

      <main className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <PathwayLogo priority className="h-8 w-auto" />
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Maintenance in progress
          </div>
        </div>

        <Surface padding="p-6 sm:p-8" className="rounded-2xl text-center shadow-sm">
          <h1
            className="text-[2rem] leading-[1.1] tracking-tight text-foreground sm:text-[2.15rem]"
            style={{ fontFamily: "var(--font-maintenance-display), var(--font-inter)" }}
          >
            We&apos;ll be right back
          </h1>
          <p className="mx-auto mt-4 text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
            Pathway is temporarily offline. We&apos;ve seen an unexpected surge in signups and need a
            short maintenance window to scale our infrastructure before we can welcome more people.
            Please check back soon.
          </p>
          <div className="mt-6 flex justify-center">
            <MaintenanceRefreshButton />
          </div>
        </Surface>
      </main>
    </div>
  );
}
