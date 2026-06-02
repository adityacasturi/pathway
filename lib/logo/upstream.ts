/**
 * Server-side logo.dev fetch helpers for `/api/logo`.
 *
 * Publishable keys (`pk_`) with "Allowed domains only" require a Referer that
 * matches the dashboard allowlist. Vercel/server `fetch` sends no Referer by
 * default, which logo.dev rejects with 403.
 */

export function logoDevReferer(): string {
  const fromSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromSite) {
    return `${fromSite.replace(/\/$/, "")}/`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return `https://${host}/`;
  }

  return "http://localhost:3000/";
}

/** Status returned to the browser for a given logo.dev upstream status. */
export function logoProxyStatusFromUpstream(upstreamStatus: number): number {
  if (upstreamStatus >= 200 && upstreamStatus < 300) {
    return 200;
  }
  if (upstreamStatus === 404) {
    return 404;
  }
  // 401/403 (token, domain restrictions), 429, 5xx → retryable for the client.
  return 503;
}

export function isRetryableLogoProxyStatus(status: number): boolean {
  return status === 503;
}
