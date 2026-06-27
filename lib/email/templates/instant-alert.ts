import type { AlertPostingCandidate } from "../../alerts/types.ts";
import {
  buildCompanyLogoUrl,
  escapeHtml,
  renderAlertEmailLayout,
} from "./alert-email-layout.ts";

export function buildInstantAlertSubject(posting: AlertPostingCandidate): string {
  return `${posting.companyName}: New internship - ${posting.roleName}`;
}

export function buildInstantAlertHtml(userId: string, posting: AlertPostingCandidate): string {
  const logoUrl = buildCompanyLogoUrl(posting.companySlug);
  const meta = [posting.season, posting.location?.trim()].filter(Boolean).join(" | ");

  const bodyHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border-collapse:collapse;">
      <tr>
        <td width="42" valign="middle" style="padding:0 10px 0 0;">
          <img src="${escapeHtml(logoUrl)}" width="34" height="34" alt="" style="display:block;width:34px;height:34px;border-radius:8px;border:1px solid #e5e7eb;object-fit:contain;">
        </td>
        <td valign="middle" style="padding:0;">
          <span style="display:block;font-size:17px;line-height:1.25;font-weight:800;color:#111827;">${escapeHtml(posting.companyName)}</span>
          <span style="display:block;margin-top:2px;font-size:13px;line-height:1.4;color:#6b7280;">posted a new internship</span>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.45;color:#111827;">
      <a href="${escapeHtml(posting.postingUrl)}" style="color:#111827;text-decoration:underline;font-weight:600;">${escapeHtml(posting.roleName)}</a>${meta ? `<span style="color:#6b7280;"> | ${escapeHtml(meta)}</span>` : ""}
    </p>
    <p style="margin:18px 0 0;">
      <a href="${escapeHtml(posting.postingUrl)}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">View posting</a>
    </p>`;

  return renderAlertEmailLayout({
    userId,
    title: posting.roleName,
    bodyHtml,
  });
}
