import { DIGEST_MAX_POSTINGS } from "@/lib/config/alerts";
import type { AlertPostingCandidate } from "@/lib/alerts/types";
import { getSiteUrl } from "@/lib/alerts/site-url";
import {
  buildCompanyLogoUrl,
  escapeHtml,
  renderAlertEmailLayout,
} from "@/lib/email/templates/alert-email-layout";

export function buildDigestAlertSubject(count: number): string {
  const label = count === 1 ? "internship" : "internships";
  return `Your daily digest: ${count} new ${label}`;
}

export function buildDigestAlertHtml(
  userId: string,
  postings: AlertPostingCandidate[],
): string {
  const visible = postings.slice(0, DIGEST_MAX_POSTINGS);
  const grouped = new Map<string, AlertPostingCandidate[]>();

  for (const posting of visible) {
    const bucket = grouped.get(posting.companyName) ?? [];
    bucket.push(posting);
    grouped.set(posting.companyName, bucket);
  }

  const sections = Array.from(grouped.entries())
    .map(([companyName, companyPostings]) => {
      const firstPosting = companyPostings[0];
      const logoUrl = firstPosting ? buildCompanyLogoUrl(firstPosting.companySlug) : null;
      const rows = companyPostings
        .map((posting) => {
          const meta = [posting.season, posting.location?.trim()].filter(Boolean).join(" | ");
          return `<p style="margin:0 0 8px;font-size:14px;line-height:1.45;color:#111827;">
            <a href="${escapeHtml(posting.postingUrl)}" style="color:#111827;text-decoration:underline;font-weight:600;">${escapeHtml(posting.roleName)}</a>${meta ? `<span style="color:#6b7280;"> | ${escapeHtml(meta)}</span>` : ""}
          </p>`;
        })
        .join("");

      const logoHtml = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border-radius:8px;border:1px solid #e5e7eb;object-fit:contain;">`
        : `<span style="display:block;width:32px;height:32px;border-radius:8px;background:#f3f4f6;border:1px solid #e5e7eb;"></span>`;

      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;border-collapse:collapse;">
        <tr>
          <td width="40" valign="middle" style="padding:0 10px 8px 0;">${logoHtml}</td>
          <td valign="middle" style="padding:0 0 8px 0;">
            <span style="display:block;font-size:16px;line-height:1.25;font-weight:650;color:#111827;">${escapeHtml(companyName)}</span>
          </td>
        </tr>
      </table>
      <div style="margin:0 0 22px;">${rows}</div>`;
    })
    .join("");

  const overflow =
    postings.length > DIGEST_MAX_POSTINGS
      ? `<p style="margin:0 0 12px;color:#6b7280;font-size:14px;line-height:1.5;">+ ${postings.length - DIGEST_MAX_POSTINGS} more on Pathway.</p>`
      : "";

  const openingsUrl = `${getSiteUrl()}/openings`;
  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#4b5563;">
      New roles from companies and bundles you follow.
    </p>
    ${sections}
    ${overflow}
    <p style="margin:20px 0 0;">
      <a href="${escapeHtml(openingsUrl)}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Browse openings</a>
    </p>`;

  return renderAlertEmailLayout({
    userId,
    title: `${postings.length} new ${postings.length === 1 ? "internship" : "internships"}`,
    bodyHtml,
  });
}
