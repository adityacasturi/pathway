"use client";

import Link from "next/link";
import { useOptionalNavigationPending } from "@/components/app-shell/navigation-pending";

/**
 * Thin wrapper around next/link for app navigation with instant pending feedback.
 */

interface Props {
  href: string;
  children: React.ReactNode;
  className?: string;
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
  prefetch = true,
  onClick,
  onPointerEnter,
  onFocus,
  ariaLabel,
}: Props) {
  const navigationPending = useOptionalNavigationPending();

  return (
    <Link
      href={href}
      className={className}
      prefetch={prefetch}
      onPointerDown={() => navigationPending?.startNavigation(href)}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
