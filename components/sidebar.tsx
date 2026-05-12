"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChartNoAxesCombined,
  Compass,
  Home as HomeIcon,
  LayoutGrid,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/nav-link";
import {
  DashboardSkeleton,
  DiscoverSkeleton,
  HomeSkeleton,
  SettingsSkeleton,
  StatsSkeleton,
} from "@/components/route-skeletons";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon, skeleton: <HomeSkeleton /> },
  { href: "/applications", label: "Applications", icon: LayoutGrid, skeleton: <DashboardSkeleton /> },
  { href: "/stats", label: "Stats", icon: ChartNoAxesCombined, skeleton: <StatsSkeleton /> },
  { href: "/discover", label: "Discover", icon: Compass, skeleton: <DiscoverSkeleton /> },
  { href: "/settings", label: "Settings", icon: Settings, skeleton: <SettingsSkeleton /> },
] as const;

type PillPosition = {
  left: number;
  width: number;
  ready: boolean;
};

function getActiveNavHref(pathname: string) {
  if (pathname === "/") return "/";
  return NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href))?.href ?? "/";
}

function getNavToneClass(active: boolean, pillReady: boolean) {
  if (!active) return "text-muted-foreground hover:text-foreground";
  return pillReady ? "text-primary-foreground" : "text-foreground";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [intendedHref, setIntendedHref] = useState<string | null>(null);
  const activeHref = intendedHref ?? pathname;
  const activeNavHref = getActiveNavHref(activeHref);
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [pillPosition, setPillPosition] = useState<PillPosition>({
    left: 0,
    width: 0,
    ready: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIntendedHref(null);
  }, [pathname]);

  useEffect(() => {
    const prefetchAll = () => {
      for (const item of NAV_ITEMS) {
        if (item.href !== pathname) router.prefetch(item.href);
      }
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }

    const timeout = globalThis.setTimeout(prefetchAll, 250);
    return () => globalThis.clearTimeout(timeout);
  }, [pathname, router]);

  useLayoutEffect(() => {
    function updatePillPosition() {
      const nav = navRef.current;
      const item = itemRefs.current[activeNavHref];
      if (!nav || !item) return;

      const navRect = nav.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const next = {
        left: itemRect.left - navRect.left,
        width: itemRect.width,
        ready: true,
      };

      setPillPosition((current) =>
        current.left === next.left && current.width === next.width && current.ready
          ? current
          : next,
      );
    }

    updatePillPosition();

    const nav = navRef.current;
    const item = itemRefs.current[activeNavHref];
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePillPosition);

    if (resizeObserver) {
      if (nav) resizeObserver.observe(nav);
      if (item) resizeObserver.observe(item);
    }

    window.addEventListener("resize", updatePillPosition);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePillPosition);
    };
  }, [activeNavHref]);

  return (
    <nav
      ref={navRef}
      aria-label="Pages"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 overflow-hidden rounded-full border bg-card p-1"
      style={{
        borderColor: "var(--rule-strong)",
        boxShadow: "0 1px 0 color-mix(in oklab, var(--ink) 4%, transparent)",
      }}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 rounded-full primary-surface"
        initial={false}
        animate={{
          opacity: pillPosition.ready ? 1 : 0,
          x: pillPosition.left,
          width: pillPosition.width,
        }}
        transition={{
          type: "spring",
          stiffness: 520,
          damping: 42,
          mass: 0.75,
        }}
        style={{ left: 0 }}
      />
      {NAV_ITEMS.map(({ href, label, icon: Icon, skeleton }) => {
        const active = activeNavHref === href;
        const toneClass = getNavToneClass(active, pillPosition.ready);

        return (
          <span
            key={href}
            ref={(node) => {
              itemRefs.current[href] = node;
            }}
            className="relative z-10 inline-flex"
          >
            <NavLink
              href={href}
              pendingSkeleton={skeleton}
              onClick={() => {
                setIntendedHref(href);
                router.prefetch(href);
              }}
              onPointerEnter={() => router.prefetch(href)}
              onFocus={() => router.prefetch(href)}
              ariaLabel={label}
              className={`relative inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors duration-200 sm:px-3 sm:text-[13px] ${toneClass}`}
            >
              <Icon size={13} strokeWidth={1.8} className="relative shrink-0" />
              <span className="sr-only sm:not-sr-only sm:relative sm:tracking-tight">{label}</span>
            </NavLink>
          </span>
        );
      })}
    </nav>
  );
}
