import { createUnsubscribeToken } from "@/lib/alerts/unsubscribe-token";
import { getSiteUrl, getUnsubscribeSecret } from "@/lib/alerts/site-url";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildUnsubscribeUrl(userId: string): string | null {
  const secret = getUnsubscribeSecret();
  if (!secret) {
    return null;
  }
  const token = createUnsubscribeToken(userId, secret);
  return `${getSiteUrl()}/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Email clients render on light backgrounds — always use light static logos. */
export function buildCompanyLogoUrl(companySlug: string): string {
  return `${getSiteUrl()}/company-logos/${encodeURIComponent(companySlug)}.png`;
}

export function renderAlertEmailLayout(options: {
  userId: string;
  title: string;
  bodyHtml: string;
}): string {
  const siteUrl = getSiteUrl();
  const alertsUrl = `${siteUrl}/alerts`;
  const logoUrl = `${siteUrl}/brand/pathway-logo-black-transparent-600w.png`;
  const unsubscribeUrl = buildUnsubscribeUrl(options.userId);
  const footerParts = [
    `<a href="${escapeHtml(alertsUrl)}" style="color:#4b5563;text-decoration:underline;">Manage alerts</a>`,
  ];
  if (unsubscribeUrl) {
    footerParts.push(
      `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f5f5f3;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;color:#f5f5f3;font-size:1px;line-height:1px;">
      Pathway found new internships matching your alerts.
    </div>
    <div style="max-width:600px;margin:0 auto;padding:28px 18px;">
      <div style="margin:0 0 18px;">
        <img src="${escapeHtml(logoUrl)}" width="112" alt="Pathway" style="display:block;width:112px;height:auto;border:0;outline:none;text-decoration:none;">
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:28px;">
      <p style="margin:0 0 10px;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-weight:800;">Pathway Alerts</p>
      <h1 style="margin:0 0 18px;font-size:24px;line-height:1.2;font-weight:750;color:#111827;">${escapeHtml(options.title)}</h1>
      ${options.bodyHtml}
      <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5;">
        ${footerParts.join(" | ")}
      </p>
      </div>
    </div>
  </body>
</html>`;
}

export { escapeHtml };
