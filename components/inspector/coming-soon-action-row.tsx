import type { LucideIcon } from "lucide-react";
import { SoonBadge } from "@/components/design-system/coming-soon-hover-card";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  primary: {
    row: "border-[color:color-mix(in_oklab,var(--primary)_18%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]",
    icon: "border-border bg-muted text-[var(--icon-accent-fg)]",
  },
  success: {
    row: "border-[color:color-mix(in_oklab,var(--success)_18%,var(--border))] bg-[color-mix(in_oklab,var(--success)_5%,var(--card))]",
    icon: "border-border bg-muted text-[var(--success)]",
  },
  accent: {
    row: "border-[color:color-mix(in_oklab,var(--accent)_18%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_5%,var(--card))]",
    icon: "border-border bg-muted text-[var(--icon-accent-fg)]",
  },
  violet: {
    row: "border-[color:color-mix(in_oklab,var(--primary)_18%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_6%,var(--card))]",
    icon: "border-border bg-muted text-[var(--icon-accent-fg)]",
  },
} as const;

export function ComingSoonActionRow({
  icon: Icon,
  title,
  tagline,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
  detail?: string;
  tone?: keyof typeof TONE_STYLES;
  className?: string;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3",
        styles.row,
        className,
      )}
      aria-label={`${title}, coming soon`}
    >
      <div
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
          styles.icon,
        )}
        aria-hidden
      >
        <Icon className="size-[17px]" strokeWidth={1.65} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[14px] font-semibold leading-snug tracking-tight text-foreground">
            {title}
          </p>
          <SoonBadge className="mt-px shrink-0" />
        </div>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{tagline}</p>
      </div>
    </div>
  );
}
