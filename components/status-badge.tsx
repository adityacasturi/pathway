"use client";

import { EventType, Status } from "@/types/application";
import { STATUS_LABELS } from "@/lib/config/events";
import { cn } from "@/lib/utils";

const STATUS_COLOR_VAR: Record<Status, string> = {
  applied: "--status-applied-fg",
  oa: "--status-oa-fg",
  interview: "--status-interview-fg",
  offer: "--status-offer-fg",
  rejected: "--status-rejected-fg",
};

const EVENT_COLOR_VAR: Record<EventType, string> = {
  ...STATUS_COLOR_VAR,
  note: "--status-note-fg",
};

const STATUS_TINT: Record<Status, number> = {
  applied: 10,
  oa: 14,
  interview: 14,
  offer: 18,
  rejected: 14,
};

function colorVar(name: string): string {
  return `var(${name})`;
}

function toneStyle(colorVarName: string, tintPercent: number): React.CSSProperties {
  const color = colorVar(colorVarName);
  return {
    color,
    backgroundColor: `color-mix(in oklab, ${color} ${tintPercent}%, transparent)`,
    borderColor: `color-mix(in oklab, ${color} 28%, var(--border))`,
  };
}

/** Card / panel highlight for the active pipeline stage filter. */
export function statusSurfaceStyle(status: Status): React.CSSProperties {
  const name = STATUS_COLOR_VAR[status];
  const color = colorVar(name);
  return {
    backgroundColor: `color-mix(in oklab, ${color} 16%, var(--card))`,
    borderColor: `color-mix(in oklab, ${color} 36%, var(--border))`,
    boxShadow: `inset 0 1px 0 color-mix(in oklab, ${color} 12%, transparent)`,
  };
}

export function StatusBadge({
  status,
  variant = "default",
  className,
}: {
  status: Status;
  variant?: "default" | "compact" | "plain";
  className?: string;
}) {
  const colorVarName = STATUS_COLOR_VAR[status];
  const label = STATUS_LABELS[status];
  const baseStyle = toneStyle(colorVarName, STATUS_TINT[status]);

  if (variant === "plain") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center gap-1 text-sm font-medium",
          className,
        )}
        style={{ color: colorVar(colorVarName) }}
      >
        <StatusDot status={status} size={6} />
        <span>{label}</span>
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span className={cn("status-pill status-pill--compact", className)} style={baseStyle}>
        <StatusDot status={status} size={6} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span className={cn("status-pill", className)} style={{ ...baseStyle, minWidth: 84 }}>
      <StatusDot status={status} size={7} />
      <span>{label}</span>
    </span>
  );
}

function dotStyle(size: number, colorVarName: string): React.CSSProperties {
  return {
    display: "inline-block",
    width: size,
    height: size,
    borderRadius: 9999,
    background: colorVar(colorVarName),
    flexShrink: 0,
  };
}

export function StatusDot({ status, size = 7 }: { status: Status; size?: number }) {
  return <span style={dotStyle(size, STATUS_COLOR_VAR[status])} />;
}

export function EventDot({ type, size = 7 }: { type: EventType; size?: number }) {
  return <span style={dotStyle(size, EVENT_COLOR_VAR[type])} />;
}

/** Retained export for compatibility with the event timeline's "offer" treatment. */
export function OfferDot({ size = 7 }: { size?: number; halo?: boolean }) {
  return <StatusDot status="offer" size={size} />;
}
