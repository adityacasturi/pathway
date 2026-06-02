import type { AlertPostingCandidate } from "@/lib/alerts/types";
import { escapeHtml, renderAlertEmailLayout } from "@/lib/email/templates/alert-email-layout";

export function buildInstantAlertSubject(posting: AlertPostingCandidate): string {
  return `${posting.companyName}: New internship — ${posting.roleName}`;
}

export function buildInstantAlertHtml(userId: string, posting: AlertPostingCandidate): string {
  const locationLine = posting.location?.trim()
    ? `<p style="margin:0 0 8px;color:#444;">${escapeHtml(posting.location)} · ${escapeHtml(posting.season)}</p>`
    : `<p style="margin:0 0 8px;color:#444;">${escapeHtml(posting.season)}</p>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#222;">
      <strong>${escapeHtml(posting.companyName)}</strong> posted a new internship:
    </p>
    <p style="margin:0 0 8px;font-size:18px;font-weight:600;line-height:1.35;">${escapeHtml(posting.roleName)}</p>
    ${locationLine}
    <p style="margin:16px 0 0;">
      <a href="${escapeHtml(posting.postingUrl)}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-size:14px;">View posting</a>
    </p>`;

  return renderAlertEmailLayout({
    userId,
    title: posting.roleName,
    bodyHtml,
  });
}
