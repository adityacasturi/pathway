"use client";

import Link, { useLinkStatus } from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/**
 * Thin wrapper around next/link so the nav can centralize prefetch, intent,
 * accessibility props, and a polished full-page pending layer for routes that
 * are not ready by the time the user clicks.
 */

interface Props {
  href: string;
  children: React.ReactNode;
  className?: string;
  pendingSkeleton: React.ReactNode;
  prefetch?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  onPointerEnter?: React.PointerEventHandler<HTMLAnchorElement>;
  onFocus?: React.FocusEventHandler<HTMLAnchorElement>;
  ariaLabel?: string;
}

export function NavLink({
  href,
  children,
  className,
  pendingSkeleton,
  prefetch = true,
  onClick,
  onPointerEnter,
  onFocus,
  ariaLabel,
}: Props) {
  return (
    <Link
      href={href}
      className={className}
      prefetch={prefetch}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      aria-label={ariaLabel}
    >
      {children}
      <PendingOverlay skeleton={pendingSkeleton} />
    </Link>
  );
}

function PendingOverlay({ skeleton }: { skeleton: React.ReactNode }) {
  const { pending } = useLinkStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {pending && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-30 bg-background"
          aria-hidden="true"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12, delay: 0 } }}
          transition={{ duration: 0.18, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2, transition: { duration: 0.12, delay: 0 } }}
            transition={{ duration: 0.22, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {skeleton}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
