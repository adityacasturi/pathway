"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  Home,
  LayoutGrid,
  Lock,
  Mail,
  Plus,
  Radio,
  Search,
  Settings,
  Wand2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SCOUT_ENABLED } from "@/lib/config/scout";
import { NAV_LABELS, NAV_SECTIONS, type NavHref } from "@/lib/config/nav";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<NavHref, typeof LayoutGrid> = {
  "/home": Home,
  "/chat": Wand2,
  "/applications": LayoutGrid,
  "/openings": Radio,
  "/companies": Compass,
  "/alerts": Mail,
  "/settings": Settings,
};

type QuickAction = {
  id: string;
  label: string;
  hint: string;
  icon: typeof Plus;
  event?: string;
  disabled?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "ask-pathway",
    label: "Scout",
    hint: SCOUT_ENABLED ? "Chat" : "Soon",
    icon: Wand2,
    event: "pathway:ask-pathway",
    disabled: !SCOUT_ENABLED,
  },
  {
    id: "add-application",
    label: "Add application",
    hint: "Applications",
    icon: Plus,
    event: "pathway:create-application",
  },
  {
    id: "focus-search",
    label: "Focus search",
    hint: "/",
    icon: Search,
    event: "pathway:focus-search",
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const navSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NAV_SECTIONS.map((section) => ({
      label: section.label,
      items: section.items.flatMap((item) => {
        if (item.kind !== "link") return [];
        const href = item.href;
        if (!q) return [href];
        return NAV_LABELS[href].toLowerCase().includes(q) || href.includes(q) ? [href] : [];
      }),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  const actionItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return QUICK_ACTIONS.filter((action) => {
      if (!q) return true;
      return (
        action.label.toLowerCase().includes(q) ||
        action.hint.toLowerCase().includes(q) ||
        action.id.includes(q)
      );
    });
  }, [query]);

  const go = useCallback(
    (href: NavHref) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  const runAction = useCallback((eventName: string) => {
    setOpen(false);
    setQuery("");
    window.dispatchEvent(new CustomEvent(eventName));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pathway:open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pathway:open-command-palette", onOpenEvent);
    };
  }, []);

  const hasResults = navSections.length > 0 || actionItems.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pages and actions…"
              className="h-10 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
              aria-label="Search command palette"
            />
          </div>
        </DialogHeader>
        <div className="max-h-[min(28rem,55vh)] overflow-y-auto p-2">
          {actionItems.length > 0 ? (
            <section className="mb-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Actions
              </p>
              <ul>
                {actionItems.map((action) => {
                  const Icon = action.icon;
                  return (
                    <li key={action.id}>
                      <button
                        type="button"
                        disabled={action.disabled}
                        aria-label={action.disabled ? `${action.label}, coming soon` : action.label}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors",
                          action.disabled
                            ? "cursor-default text-muted-foreground/70"
                            : "hover:bg-muted/70",
                        )}
                        onClick={() => {
                          if (action.disabled) return;
                          if (action.id === "ask-pathway") {
                            setOpen(false);
                            const q = query.trim();
                            router.push(q ? `/chat?q=${encodeURIComponent(q)}` : "/chat");
                            setQuery("");
                            return;
                          }
                          if (action.event) runAction(action.event);
                        }}
                      >
                        <Icon
                          size={16}
                          strokeWidth={1.75}
                          className={action.disabled ? "text-muted-foreground/65" : "text-muted-foreground"}
                        />
                        <span
                          className={cn(
                            "font-medium",
                            action.disabled ? "text-muted-foreground" : "text-foreground",
                          )}
                        >
                          {action.label}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                          {action.disabled ? <Lock size={10} strokeWidth={1.8} aria-hidden /> : null}
                          {action.hint}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {navSections.map((section) => (
            <section key={section.label} className="mb-2 last:mb-0">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {section.label}
              </p>
              <ul>
                {section.items.map((href) => {
                  const Icon = NAV_ICONS[href];
                  return (
                    <li key={href}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors",
                          "hover:bg-muted/70",
                        )}
                        onClick={() => go(href)}
                      >
                        <Icon size={16} strokeWidth={1.75} className="text-muted-foreground" />
                        <span className="font-medium text-foreground">{NAV_LABELS[href]}</span>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{href}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {!hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</p>
          ) : null}
        </div>
        <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <kbd className="rounded border border-border bg-muted px-1 font-mono">⌘K</kbd> anywhere ·{" "}
          <kbd className="rounded border border-border bg-muted px-1 font-mono">/</kbd> search
        </div>
      </DialogContent>
    </Dialog>
  );
}
