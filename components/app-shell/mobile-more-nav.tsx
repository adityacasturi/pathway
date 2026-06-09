"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, Mail, MoreHorizontal, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDisplayNavHref, useNavigationPending } from "@/components/app-shell/navigation-pending";
import { type NavHref } from "@/lib/config/nav";
import { cn } from "@/lib/utils";

const MORE_LINKS: Array<{ href: NavHref; icon: typeof Compass; label: string }> = [
  { href: "/companies", icon: Compass, label: "Companies" },
  { href: "/alerts", icon: Mail, label: "Alerts" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function MobileMoreNav() {
  const [open, setOpen] = useState(false);
  const { startNavigation } = useNavigationPending();
  const active = useDisplayNavHref();
  const moreActive = MORE_LINKS.some((link) => active === link.href);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-medium",
          "transition-[background-color,color,transform] duration-200 ease-[var(--motion-ease-smooth)] active:scale-[0.97]",
          moreActive ? "bg-muted text-foreground" : "text-muted-foreground",
        )}
        aria-label="More pages"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
        <span className="truncate">More</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm" showCloseButton>
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-sm font-semibold">More</DialogTitle>
          </DialogHeader>
          <ul className="p-2">
            {MORE_LINKS.map(({ href, icon: Icon, label }) => {
              const isActive = active === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => {
                      setOpen(false);
                      startNavigation(href);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-foreground hover:bg-muted/70",
                    )}
                  >
                    <Icon size={16} strokeWidth={1.75} className="text-muted-foreground" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
