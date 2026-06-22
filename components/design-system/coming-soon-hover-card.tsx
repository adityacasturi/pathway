"use client";

import type { ComponentType, CSSProperties, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type CardSide = "right" | "left" | "top" | "bottom";

const CARD_WIDTH = 272;
const VIEWPORT_MARGIN = 12;
const GAP = 10;

function computeCardStyle(anchor: DOMRect, side: CardSide): CSSProperties {
  const maxLeft = window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN;
  const clampLeft = (left: number) => Math.min(Math.max(left, VIEWPORT_MARGIN), maxLeft);

  switch (side) {
    case "bottom":
      return {
        top: anchor.bottom + GAP,
        left: clampLeft(anchor.left),
      };
    case "top":
      return {
        top: anchor.top - GAP,
        left: clampLeft(anchor.left),
        transform: "translateY(-100%)",
      };
    case "right":
      return {
        top: anchor.top + anchor.height / 2,
        left: Math.min(anchor.right + GAP, maxLeft),
        transform: "translateY(-50%)",
      };
    case "left":
      return {
        top: anchor.top + anchor.height / 2,
        left: Math.max(anchor.left - GAP - CARD_WIDTH, VIEWPORT_MARGIN),
        transform: "translateY(-50%)",
      };
    default: {
      const _exhaustive: never = side;
      return _exhaustive;
    }
  }
}

export function ComingSoonHoverCard({
  title,
  hint,
  description,
  detail,
  icon: Icon,
  side = "right",
  className,
  children,
}: {
  title: string;
  hint?: string;
  description: string;
  detail?: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  side?: CardSide;
  className?: string;
  children: ReactNode;
}) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setCardStyle(computeCardStyle(rect, side));
  }, [side]);

  const show = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const scheduleHide = useCallback(() => {
    closeTimerRef.current = setTimeout(() => setOpen(false), 40);
  }, []);

  const cancelHide = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onReposition = () => updatePosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, updatePosition]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const card = (
    <div
      ref={cardRef}
      id={tooltipId}
      role="tooltip"
      style={{ position: "fixed", zIndex: 200, width: CARD_WIDTH, ...cardStyle }}
      className={cn(
        "pointer-events-auto rounded-xl border border-[color:color-mix(in_oklab,var(--primary)_20%,var(--border))] bg-popover px-3.5 py-3 text-popover-foreground shadow-[0_20px_48px_-28px_color-mix(in_oklab,var(--ink)_55%,transparent),0_0_0_1px_color-mix(in_oklab,var(--primary)_6%,transparent)]",
        "transition-[opacity,transform] duration-100 ease-out motion-reduce:transition-none",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      onMouseEnter={cancelHide}
      onMouseLeave={scheduleHide}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] blur-xl"
        aria-hidden
      />

      <div className="relative flex items-start gap-3">
        {Icon ? (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-[var(--icon-accent-fg)]">
            <Icon className="size-4" strokeWidth={1.65} />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug tracking-normal text-foreground">
            {title}{" "}
            <span className="font-medium text-muted-foreground">(coming soon)</span>
          </p>
          {hint ? (
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{hint}</p>
          ) : null}
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          {detail ? (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/90">{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={anchorRef}
      className={cn("relative", className)}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && (anchorRef.current?.contains(next) || cardRef.current?.contains(next))) return;
        scheduleHide();
      }}
    >
      <div aria-describedby={open ? tooltipId : undefined}>{children}</div>
      {mounted && open ? createPortal(card, document.body) : null}
    </div>
  );
}
