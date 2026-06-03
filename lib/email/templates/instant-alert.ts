import type { AlertPostingCandidate } from "@/lib/alerts/types";
import { escapeHtml, renderAlertEmailLayout } from "@/lib/email/templates/alert-email-layout";

export function buildInstantAlertSubject(posting: AlertPostingCandidate): string {
  return `${posting.companyName}: New internship - ${posting.roleName}`;
}

export function buildInstantAlertHtml(userId: string, posting: AlertPostingCandidate): string {
  const locationLine = posting.location?.trim()
    ? `<p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.5;">${escapeHtml(posting.location)} | ${escapeHtml(posting.season)}</p>`
    : `<p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.5;">${escapeHtml(posting.season)}</p>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151;">
      <strong>${escapeHtml(posting.companyName)}</strong> posted a new internship:
    </p>
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;line-height:1.35;color:#111827;">${escapeHtml(posting.roleName)}</p>
    ${locationLine}
    <p style="margin:20px 0 0;">
      <a href="${escapeHtml(posting.postingUrl)}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">View posting</a>
    </p>`;

  return renderAlertEmailLayout({
    userId,
    title: posting.roleName,
    bodyHtml,
  });
}
