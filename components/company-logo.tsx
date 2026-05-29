"use client";

import { useEffect, useState } from "react";
import { logoUrl, normalizeLogoCompany } from "@/lib/logo";

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
const FAILED_STORAGE_KEY = "pathway:logo-failed:v4";
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

function cacheKey(company: string): string {
  return normalizeLogoCompany(company);
}

interface Props {
  company: string;
  size?: number;
}

export function CompanyLogo({ company, size = 20 }: Props) {
  const key = cacheKey(company);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Re-check the shared cache whenever the company changes; no network
    // work if we already know this one fails. Keep the initial value stable
    // between server render and hydration; sessionStorage is client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(failedCompanies.has(cacheKey(company)));
  }, [company]);

  if (failed || !company.trim()) {
    return (
      <div
        className={`flex items-center justify-center rounded-sm text-xs font-semibold shrink-0 ${avatarColor(company)}`}
        style={{ width: size, height: size }}
        aria-label={`${company || "Company"} logo`}
      >
        {initial(company)}
      </div>
    );
  }

  return (
    // Plain <img> (not next/image) because /api/logo is already a small,
    // cacheable first-party proxy. `logoUrl` returns a single canonical URL
    // per company so every surface hits the same browser cache entry.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl(company)}
      alt={`${company} logo`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => {
        failedCompanies.add(key);
        persistFailed();
        setFailed(true);
      }}
      className="rounded-sm object-contain shrink-0"
    />
  );
}
