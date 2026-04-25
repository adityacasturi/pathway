"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
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
} from "@/components/route-skeletons";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon, skeleton: <HomeSkeleton /> },
  { href: "/applications", label: "Applications", icon: LayoutGrid, skeleton: <DashboardSkeleton /> },
  { href: "/discover", label: "Discover", icon: Compass, skeleton: <DiscoverSkeleton /> },
  { href: "/settings", label: "Settings", icon: Settings, skeleton: <SettingsSkeleton /> },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [intendedHref, setIntendedHref] = useState<string | null>(null);
  const activeHref = intendedHref ?? pathname;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIntendedHref(null);
  }, [pathname]);

  return (
    <nav
      aria-label="Pages"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 rounded-full border bg-card p-1"
      style={{
        borderColor: "var(--rule-strong)",
        boxShadow: "0 1px 0 color-mix(in oklab, var(--ink) 4%, transparent)",
      }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, skeleton }) => {
        const active =
          href === "/" ? activeHref === "/" : activeHref.startsWith(href);
        return (
          <NavLink
            key={href}
            href={href}
            pendingSkeleton={skeleton}
            onClick={() => setIntendedHref(href)}
            className={`relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors duration-200 ${
              active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active && (
              <motion.span
                aria-hidden
                layoutId="nav-active-pill"
                className="absolute inset-0 rounded-full primary-surface"
                transition={{ type: "spring", stiffness: 480, damping: 40 }}
              />
            )}
            <Icon size={13} strokeWidth={2} className="relative" />
            <span className="relative hidden sm:inline tracking-tight">{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
