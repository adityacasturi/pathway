"use client";

import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/**
 * Wraps next/link so that the moment a nav link is clicked we portal a
 * full-screen skeleton over the current page. Without this, the router
 * keeps the old UI visible until the RSC payload starts streaming (a
 * ~200–600ms gap in dev where prefetch hasn't kicked in), which reads as
 * an unresponsive click. See Next.js docs on useLinkStatus:
 * https://nextjs.org/docs/app/api-reference/functions/use-link-status
 *
 * The actual loading.tsx files still cover direct URL loads; this only
 * handles the in-app click path.
 */

interface Props {
  href: string;
  children: React.ReactNode;
  className?: string;
  pendingSkeleton: React.ReactNode;
  prefetch?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export function NavLink({ href, children, className, pendingSkeleton, prefetch, onClick }: Props) {
  return (
    <Link href={href} className={className} prefetch={prefetch} onClick={onClick}>
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

  if (!mounted || !pending) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-30 bg-background"
      aria-hidden="true"
      aria-busy="true"
    >
      {skeleton}
    </div>,
    document.body,
  );
}
