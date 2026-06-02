"use client";

import { useEffect, useRef, useState } from "react";
import { logoCacheKey, logoDomainFromWebsite, logoUrl } from "@/lib/logo";

const LAZY_LOGO_ROOT_MARGIN = "240px 0px";

// Deterministic color per company name so the same company always gets the
// same avatar color across renders.
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-950",
  "bg-slate-100 text-slate-700",
  "bg-indigo-100 text-indigo-700",
  "bg-zinc-100 text-zinc-700",
  "bg-stone-100 text-stone-700",
  "bg-slate-200 text-slate-700",
];

function avatarColor(company: string): string {
  const hash = company.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initial(company: string): string {
  const trimmed = company.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

// Module-level cache of companies whose logo fetch has already failed. Keeps
// us from hammering logo.dev every time a known-bad logo scrolls back into
// view, or after a navigation re-mounts the component. Seeded from
// sessionStorage on load so a same-tab refresh doesn't retry every failure.
const FAILED_STORAGE_KEY = "pathway:logo-failed:v6";
const failedCompanies = new Set<string>(readFailedFromStorage());

function readFailedFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(FAILED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function persistFailed() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      FAILED_STORAGE_KEY,
      JSON.stringify(Array.from(failedCompanies)),
    );
  } catch {
    // sessionStorage can throw (private mode, quota). Failures here are
    // purely an optimisation miss, not a correctness issue.
  }
}

function InitialAvatar({ company, size }: { company: string; size: number }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-sm text-xs font-semibold ${avatarColor(company)}`}
      style={{ width: size, height: size }}
      aria-label={`${company || "Company"} logo`}
    >
      {initial(company)}
    </div>
  );
}

interface Props {
  company: string;
  /** When set, logos use logo.dev domain lookup (more accurate than name). */
  websiteUrl?: string | null;
  size?: number;
  /** Defer the logo proxy fetch until the logo nears the viewport. */
  lazy?: boolean;
}

export function CompanyLogo({ company, websiteUrl, size = 20, lazy = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const domain = logoDomainFromWebsite(websiteUrl);
  const key = logoCacheKey(company, domain);
  const resolvedLogoUrl = logoUrl(company, domain);
  const [logoLoad, setLogoLoad] = useState<{ cacheKey: string; src: string } | null>(null);
  const src = logoLoad?.cacheKey === key ? logoLoad.src : null;

  useEffect(() => {
    if (!lazy || shouldLoad) {
      return;
    }

    const el = rootRef.current;
    if (!el) {
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: LAZY_LOGO_ROOT_MARGIN },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [lazy, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !company.trim() || failedCompanies.has(key)) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function load(attempt: number) {
      try {
        const response = await fetch(resolvedLogoUrl, { credentials: "include" });
        if (cancelled) return;

        if (response.status === 404) {
          failedCompanies.add(key);
          persistFailed();
          setLogoLoad(null);
          return;
        }

        if (!response.ok) {
          if (attempt < 1) {
            retryTimer = setTimeout(() => void load(attempt + 1), 1500);
          } else {
            setLogoLoad(null);
          }
          return;
        }

        setLogoLoad({ cacheKey: key, src: resolvedLogoUrl });
      } catch {
        if (!cancelled && attempt < 1) {
          retryTimer = setTimeout(() => void load(attempt + 1), 1500);
        } else if (!cancelled) {
          setLogoLoad(null);
        }
      }
    }

    void load(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [company, key, resolvedLogoUrl, shouldLoad]);

  const showInitial = !company.trim() || failedCompanies.has(key) || !src;

  return (
    <div
      ref={rootRef}
      className="inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {showInitial ? (
        <InitialAvatar company={company} size={size} />
      ) : (
        // Plain <img> (not next/image) because /api/logo is already a small,
        // cacheable first-party proxy. `logoUrl` returns a single canonical URL
        // per company so every surface hits the same browser cache entry.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${company} logo`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="block size-full rounded-sm object-contain object-center"
        />
      )}
    </div>
  );
}
