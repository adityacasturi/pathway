"use client";

import { EventType, Status } from "@/types/application";
import { STATUS_LABELS } from "@/lib/config/events";

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
  applied:   { color: "oklch(0.55 0.02 60)",  tintPercent: 6  },
  oa:        { color: "oklch(0.55 0.08 240)", tintPercent: 8  },
  interview: { color: "oklch(0.52 0.1 280)",  tintPercent: 8  },
  offer:     { color: "oklch(0.68 0.18 150)", tintPercent: 12 },
  rejected:  { color: "oklch(0.55 0.14 30)",  tintPercent: 8  },
};

const EVENT_TONES: Record<EventType, Tone> = {
  ...STATUS_TONES,
  note: { color: "oklch(0.55 0.02 60)", tintPercent: 6 },
};

function toneStyle(tone: Tone): React.CSSProperties {
  return {
    color: tone.color,
    backgroundColor: `color-mix(in oklab, ${tone.color} ${tone.tintPercent}%, transparent)`,
    borderColor: `color-mix(in oklab, ${tone.color} 22%, transparent)`,
  };
}

export function StatusBadge({ status, variant = "default" }: { status: Status; variant?: "default" | "compact" }) {
  const tone = STATUS_TONES[status];
  const label = STATUS_LABELS[status];
  const baseStyle = toneStyle(tone);

  if (variant === "compact") {
    return (
      <span
        className="inline-flex items-center rounded-[3px] border px-1.5 py-[2px] font-mono text-[9.5px] font-medium uppercase tracking-[0.14em]"
        style={baseStyle}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-[3px] border px-2 py-[3px] font-mono text-[10.5px] font-medium uppercase tracking-[0.12em]"
      style={{ ...baseStyle, minWidth: 84 }}
    >
      {label}
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
