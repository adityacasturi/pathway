"use client";

import { EventType, Status } from "@/types/application";
import { STATUS_LABELS } from "@/lib/config/events";
import { EVENT_TYPE_COLORS, STATUS_COLORS } from "@/lib/config/status-colors";

/*
 * Status is expressed as a flat, editorial stamp — a restrained tint plus a
 * dot. This replaces the previous glossy gradient pills. Tones are pulled
 * from the single oxblood accent plus neutral greys, keeping the palette
 * disciplined and the signal clear.
 */

type Tone = {
  /** oklch hue/chroma for the dot + text */
  color: string;
  /** subtle background tint, expressed as color-mix chance */
  tintPercent: number;
};

const STATUS_TONES: Record<Status, Tone> = {
  applied:   { color: STATUS_COLORS.applied,   tintPercent: 6  },
  oa:        { color: STATUS_COLORS.oa,        tintPercent: 8  },
  interview: { color: STATUS_COLORS.interview, tintPercent: 8  },
  offer:     { color: STATUS_COLORS.offer,     tintPercent: 12 },
  rejected:  { color: STATUS_COLORS.rejected,  tintPercent: 8  },
};

const EVENT_TONES: Record<EventType, Tone> = {
  applied:   { color: EVENT_TYPE_COLORS.applied,   tintPercent: 6 },
  oa:        { color: EVENT_TYPE_COLORS.oa,        tintPercent: 8 },
  interview: { color: EVENT_TYPE_COLORS.interview, tintPercent: 8 },
  offer:     { color: EVENT_TYPE_COLORS.offer,     tintPercent: 12 },
  rejected:  { color: EVENT_TYPE_COLORS.rejected,  tintPercent: 8 },
  note:      { color: EVENT_TYPE_COLORS.note,      tintPercent: 6 },
};

function toneStyle(tone: Tone): React.CSSProperties {
  return {
    color: tone.color,
    backgroundColor: `color-mix(in oklab, ${tone.color} ${tone.tintPercent}%, transparent)`,
    borderColor: `color-mix(in oklab, ${tone.color} 22%, transparent)`,
  };
}

/** Card / panel highlight for the active pipeline stage filter. */
export function statusSurfaceStyle(status: Status): React.CSSProperties {
  const tone = STATUS_TONES[status];
  return {
    backgroundColor: `color-mix(in oklab, ${tone.color} 14%, var(--card))`,
    borderColor: `color-mix(in oklab, ${tone.color} 32%, var(--rule))`,
    boxShadow: `inset 0 1px 0 color-mix(in oklab, ${tone.color} 10%, transparent)`,
  };
}

export function StatusBadge({ status, variant = "default" }: { status: Status; variant?: "default" | "compact" }) {
  const tone = STATUS_TONES[status];
  const label = STATUS_LABELS[status];
  const baseStyle = toneStyle(tone);

  if (variant === "compact") {
    return (
      <span className="status-pill status-pill--compact" style={baseStyle}>
        <StatusDot status={status} size={6} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span className="status-pill h-8 gap-1.5 px-3 text-[13px]" style={{ ...baseStyle, minWidth: 84 }}>
      <StatusDot status={status} size={7} />
      <span>{label}</span>
    </span>
  );
}

function dotStyle(size: number, color: string): React.CSSProperties {
  return {
    display: "inline-block",
    width: size,
    height: size,
    borderRadius: 9999,
    background: color,
    flexShrink: 0,
  };
}

export function StatusDot({ status, size = 7 }: { status: Status; size?: number }) {
  return <span style={dotStyle(size, STATUS_TONES[status].color)} />;
}

export function EventDot({ type, size = 7 }: { type: EventType; size?: number }) {
  return <span style={dotStyle(size, EVENT_TONES[type].color)} />;
}

/** Retained export for compatibility with the event timeline's "offer" treatment. */
export function OfferDot({ size = 7 }: { size?: number; halo?: boolean }) {
  return <StatusDot status="offer" size={size} />;
}
