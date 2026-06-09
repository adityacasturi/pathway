"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import { ContentAreaSpinner } from "@/components/app-shell/content-area-spinner";
import { getActiveNavHref, type NavHref } from "@/lib/config/nav";

type NavigationPendingContextValue = {
  pendingHref: string | null;
  startNavigation: (href: string) => void;
  clearPending: () => void;
};

const NavigationPendingContext = createContext<NavigationPendingContextValue | null>(
  null,
);

export function useNavigationPending() {
  const context = useContext(NavigationPendingContext);
  if (!context) {
    throw new Error("useNavigationPending must be used within NavigationPendingProvider");
  }
  return context;
}

export function useOptionalNavigationPending() {
  return useContext(NavigationPendingContext);
}

/** Instant nav label/highlight — uses pending destination before pathname updates. */
export function useDisplayNavHref(): NavHref {
  const pathname = usePathname();
  const pending = useOptionalNavigationPending();
  return getActiveNavHref(pending?.pendingHref ?? pathname);
}

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearPending = useCallback(() => {
    setPendingHref(null);
  }, []);

  const startNavigation = useCallback(
    (href: string) => {
      if (getActiveNavHref(pathname) === getActiveNavHref(href)) return;
      // Paint the overlay before Next.js defers this update inside its transition.
      flushSync(() => {
        setPendingHref(href);
      });
    },
    [pathname],
  );

  return (
    <NavigationPendingContext.Provider value={{ pendingHref, startNavigation, clearPending }}>
      {children}
    </NavigationPendingContext.Provider>
  );
}

/**
 * Clears the pending overlay only after route content has swapped — not when the
 * URL updates while the previous page is still frozen on screen.
 */
export function NavigationPendingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { pendingHref, clearPending } = useNavigationPending();

  useEffect(() => {
    if (!pendingHref) return;
    if (getActiveNavHref(pathname) !== getActiveNavHref(pendingHref)) return;
    clearPending();
    // Only react to content swaps; pathname can lead the visible page during RSC fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [children]);

  return children;
}

export function NavigationPendingOverlay() {
  const { pendingHref } = useNavigationPending();

  if (!pendingHref) return null;

  return <ContentAreaSpinner />;
}
