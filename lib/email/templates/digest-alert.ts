import { DIGEST_MAX_POSTINGS } from "@/lib/config/alerts";
import type { AlertPostingCandidate } from "@/lib/alerts/types";
import { getSiteUrl } from "@/lib/alerts/site-url";
import { escapeHtml, renderAlertEmailLayout } from "@/lib/email/templates/alert-email-layout";

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
      const rows = companyPostings
        .map((posting) => {
          const meta = [posting.season, posting.location?.trim()].filter(Boolean).join(" | ");
          return `<li style="margin:0 0 10px;line-height:1.5;color:#374151;">
            <a href="${escapeHtml(posting.postingUrl)}" style="color:#111827;text-decoration:none;font-weight:700;">${escapeHtml(posting.roleName)}</a>
            ${meta ? `<span style="color:#6b7280;"> (${escapeHtml(meta)})</span>` : ""}
          </li>`;
        })
        .join("");

      return `<div style="margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(companyName)}</p>
        <ul style="margin:0;padding:0 0 0 18px;font-size:14px;">${rows}</ul>
      </div>`;
    })
    .join("");

  const overflow =
    postings.length > DIGEST_MAX_POSTINGS
      ? `<p style="margin:0 0 12px;color:#6b7280;font-size:14px;line-height:1.5;">+ ${postings.length - DIGEST_MAX_POSTINGS} more on Pathway.</p>`
      : "";

  const liveUrl = `${getSiteUrl()}/live`;
  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151;">
      New internships today from companies and sectors you follow.
    </p>
    ${sections}
    ${overflow}
    <p style="margin:20px 0 0;">
      <a href="${escapeHtml(liveUrl)}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Browse openings</a>
    </p>`;

  return renderAlertEmailLayout({
    userId,
    title: `${postings.length} new ${postings.length === 1 ? "internship" : "internships"}`,
    bodyHtml,
  });
}
