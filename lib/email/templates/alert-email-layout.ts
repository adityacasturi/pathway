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

export function renderAlertEmailLayout(options: {
  userId: string;
  title: string;
  bodyHtml: string;
}): string {
  const alertsUrl = `${getSiteUrl()}/alerts`;
  const unsubscribeUrl = buildUnsubscribeUrl(options.userId);
  const footerParts = [
    `<a href="${escapeHtml(alertsUrl)}" style="color:#555;">Manage alerts</a>`,
  ];
  if (unsubscribeUrl) {
    footerParts.push(
      `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#555;">Unsubscribe</a>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f6f4;font-family:Georgia,'Times New Roman',serif;color:#111;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e0;border-radius:12px;padding:24px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#666;">Pathway Alerts</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;font-weight:600;">${escapeHtml(options.title)}</h1>
      ${options.bodyHtml}
      <p style="margin:24px 0 0;font-size:12px;color:#666;line-height:1.5;">
        ${footerParts.join(" · ")}
      </p>
    </div>
  </body>
</html>`;
}

export { escapeHtml };
