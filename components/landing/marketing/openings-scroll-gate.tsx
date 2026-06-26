"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export function OpeningsScrollGate({
  children,
  previewDays: _previewDays,
}: {
  children: ReactNode;
  previewDays: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  const updateProgress = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const distanceToBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const nextProgress =
      scroller.scrollTop < 12 ? 0 : Math.max(0, Math.min(1, 1 - Math.max(0, distanceToBottom - 16) / 24));
    setProgress((current) => (Math.abs(current - nextProgress) < 0.01 ? current : nextProgress));
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const onScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        updateProgress();
      });
    };

    updateProgress();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateProgress);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [updateProgress]);

  return (
    <div
      className="mkt-board-shell"
      style={
        {
          "--mkt-lock-offset": `${(1 - progress) * 16}px`,
          "--mkt-lock-progress": progress,
        } as CSSProperties
      }
    >
      <div ref={scrollRef} className="mkt-board-scroll">
        {children}
      </div>
      <div
        className={progress > 0.08 ? "mkt-board-lock-overlay mkt-board-lock-overlay--active" : "mkt-board-lock-overlay"}
        aria-hidden={progress < 0.08}
      >
        <Link href="/register" className="mkt-board-lock-card mkt-board-lock-card--mobile">
          <span className="mkt-board-lock-icon" aria-hidden>
            <LockKeyhole size={14} strokeWidth={1.9} />
          </span>
          <span className="mkt-board-lock-mobile-label">Register to unlock</span>
        </Link>
        <div className="mkt-board-lock-card mkt-board-lock-card--desktop">
          <div className="mkt-board-lock-head">
            <span className="mkt-board-lock-icon" aria-hidden>
              <LockKeyhole size={17} strokeWidth={1.9} />
            </span>
            <p className="mkt-board-lock-title">Register to unlock all openings.</p>
          </div>
          <Link href="/register" className="mkt-board-lock-link">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
