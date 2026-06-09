"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchLogoProxy, peekLogoProxyCache } from "@/lib/logo/client-fetch-queue";
import { companyLogoImageClass } from "@/lib/logo/company-logo-presentation";
import { logoCacheKey, logoDomainFromWebsite, logoUrl } from "@/lib/logo";
import { companyHasStaticLogo, companyLogoStaticUrl } from "@/lib/logo/static";

/** Prefetch shortly before scroll-in; queue caps parallel `/api/logo` calls. */
const LAZY_LOGO_ROOT_MARGIN = "120px 0px";

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

const FAILED_STORAGE_KEY = "pathway:logo-failed:v8";
const failedCompanies = new Set<string>(readFailedFromStorage());
const loadedProxyByKey = new Map<string, string>();
const brokenStaticSlugs = new Set<string>();

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
    // sessionStorage can throw (private mode, quota).
  }
}

function initialProxyLoad(
  cacheKey: string,
  resolvedLogoUrl: string,
): { cacheKey: string; src: string } | null {
  if (failedCompanies.has(cacheKey)) return null;

  const remembered = loadedProxyByKey.get(cacheKey);
  if (remembered) {
    return { cacheKey, src: remembered };
  }

  if (peekLogoProxyCache(cacheKey) === "ok") {
    loadedProxyByKey.set(cacheKey, resolvedLogoUrl);
    return { cacheKey, src: resolvedLogoUrl };
  }

  return null;
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
  companySlug?: string | null;
  logoAssetKey?: string | null;
  websiteUrl?: string | null;
  size?: number;
  lazy?: boolean;
}

function resolveStaticSrc(
  normalizedSlug: string,
  staticAssetKey: string,
  logoAssetKey: string | null | undefined,
  staticBroken: boolean,
): string | null {
  if (staticBroken) return null;
  const slug =
    staticAssetKey &&
    companyHasStaticLogo(normalizedSlug || staticAssetKey, logoAssetKey)
      ? staticAssetKey
      : null;
  return slug ? companyLogoStaticUrl(slug) : null;
}

function CompanyLogoInner({
  company,
  companySlug,
  logoAssetKey,
  websiteUrl,
  size = 20,
  lazy = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoadProxy, setShouldLoadProxy] = useState(!lazy);
  const normalizedSlug = companySlug?.trim() ?? "";
  const staticAssetKey = logoAssetKey?.trim() || normalizedSlug;
  const [staticBroken, setStaticBroken] = useState(
    () => staticAssetKey.length > 0 && brokenStaticSlugs.has(staticAssetKey),
  );
  const domain = logoDomainFromWebsite(websiteUrl);

  const staticSrc = useMemo(
    () =>
      resolveStaticSrc(
        normalizedSlug,
        staticAssetKey,
        logoAssetKey,
        staticBroken,
      ),
    [logoAssetKey, normalizedSlug, staticAssetKey, staticBroken],
  );

  const key = logoCacheKey(company, domain);
  const resolvedLogoUrl = logoUrl(company, domain);

  const [logoLoad, setLogoLoad] = useState<{ cacheKey: string; src: string } | null>(() =>
    staticSrc ? null : initialProxyLoad(key, resolvedLogoUrl),
  );
  const proxySrc = logoLoad?.cacheKey === key ? logoLoad.src : null;
  const src = staticSrc ?? proxySrc;

  useEffect(() => {
    if (!lazy || shouldLoadProxy) {
      return;
    }

    const el = rootRef.current;
    if (!el) {
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoadProxy(true);
          io.disconnect();
        }
      },
      { rootMargin: LAZY_LOGO_ROOT_MARGIN },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [lazy, shouldLoadProxy]);

  useEffect(() => {
    if (staticSrc || !shouldLoadProxy || !company.trim() || failedCompanies.has(key)) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function load(attempt: number) {
      const outcome = await fetchLogoProxy(resolvedLogoUrl, key);
      if (cancelled) return;

      if (outcome === "missing") {
        failedCompanies.add(key);
        persistFailed();
        setLogoLoad(null);
        return;
      }

      if (outcome === "retryable") {
        if (attempt < 2) {
          retryTimer = setTimeout(() => void load(attempt + 1), 1500 * (attempt + 1));
        } else {
          failedCompanies.add(key);
          persistFailed();
          setLogoLoad(null);
        }
        return;
      }

      loadedProxyByKey.set(key, resolvedLogoUrl);
      setLogoLoad({ cacheKey: key, src: resolvedLogoUrl });
    }

    void load(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [company, key, resolvedLogoUrl, shouldLoadProxy, staticSrc]);

  const waitingForProxy = !staticSrc && (!shouldLoadProxy || !proxySrc);
  const showInitial = !company.trim() || failedCompanies.has(key) || waitingForProxy;

  return (
    <div
      ref={rootRef}
      className="inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      {showInitial ? (
        <InitialAvatar company={company} size={size} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${key}:${staticSrc ?? "proxy"}`}
          src={src!}
          alt={`${company} logo`}
          width={size}
          height={size}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          className={companyLogoImageClass()}
          onError={() => {
            if (staticSrc) {
              brokenStaticSlugs.add(staticAssetKey);
              setStaticBroken(true);
              return;
            }
            failedCompanies.add(key);
            persistFailed();
            setLogoLoad(null);
          }}
        />
      )}
    </div>
  );
}

export function CompanyLogo(props: Props) {
  const normalizedSlug = props.companySlug?.trim() ?? "";
  const staticAssetKey = props.logoAssetKey?.trim() || normalizedSlug;
  const domain = logoDomainFromWebsite(props.websiteUrl);
  const cacheKey = logoCacheKey(props.company, domain);

  return <CompanyLogoInner key={`${staticAssetKey}:${cacheKey}`} {...props} />;
}
