"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { SidebarNavContent } from "@/components/app-shell/sidebar-nav-content";
import { APP_SHELL_CSS_VARS } from "@/components/app-shell/shell-layout";
import { useMounted } from "@/lib/ui/use-mounted";
import { cn } from "@/lib/utils";

export function MobileNavDrawer({
  open,
  onOpenChange,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string | null;
}) {
  const pathname = usePathname();
  const mounted = useMounted();

  useEffect(() => {
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        className={cn(
          "fixed inset-x-0 bottom-0 top-[var(--app-topbar-height)] z-[48] bg-foreground/20 transition-opacity duration-200 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={APP_SHELL_CSS_VARS}
        tabIndex={open ? 0 : -1}
        onClick={() => onOpenChange(false)}
      />
      <aside
        id="mobile-app-nav"
        aria-label="Application"
        aria-hidden={!open}
        className={cn(
          "fixed bottom-0 left-0 top-[var(--app-topbar-height)] z-[49] flex w-[var(--app-sidebar-width)] flex-col border-r border-border bg-[var(--shell-sidebar)] font-sans antialiased shadow-lg transition-transform duration-200 ease-[var(--motion-ease-smooth)] md:hidden",
          open ? "translate-x-0" : "pointer-events-none -translate-x-full",
        )}
        style={APP_SHELL_CSS_VARS}
      >
        <SidebarNavContent userEmail={userEmail} onNavigate={() => onOpenChange(false)} />
      </aside>
    </>,
    document.body,
  );
}
