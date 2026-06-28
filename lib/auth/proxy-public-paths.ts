export function isProxyPublicBypassPath(pathname: string): boolean {
  return (
    pathname === "/auth/confirm" ||
    pathname.startsWith("/alerts/unsubscribe") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/school-logos/") ||
    pathname.startsWith("/company-logos/") ||
    pathname === "/api/revalidate-catalog" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png"
  );
}
