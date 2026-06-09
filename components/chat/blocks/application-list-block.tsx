"use client";

import Link from "next/link";
import { CompanyLogo } from "@/components/company-logo";
import { ChatDataCard } from "@/components/chat/chat-panel";
import { SeasonBadge } from "@/components/season-badge";
import { StatusBadge } from "@/components/status-badge";
import type { ChatApplicationListResult, ChatApplicationSummary } from "@/lib/chat/types";
import { formatCompactLocationLabel } from "@/lib/feed/us-locations";
import { safeExternalHref } from "@/lib/url";
import { LINK_MUTED_CLASS } from "@/lib/ui/link-styles";
import { cn, formatDate } from "@/lib/utils";

function ApplicationRecordRow({ application }: { application: ChatApplicationSummary }) {
  const postingHref = safeExternalHref(application.postingUrl);
  const locationLabel = application.location
    ? formatCompactLocationLabel(application.location, 2)
    : null;
  const appliedLabel = application.appliedDate ? formatDate(application.appliedDate) : null;
  const metaLine = [locationLabel, appliedLabel ? `Applied ${appliedLabel}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/30">
      <CompanyLogo company={application.company} size={32} lazy />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{application.company}</span>
          {application.season ? (
            <SeasonBadge season={application.season} variant="plain" className="shrink-0" />
          ) : null}
        </div>
        {postingHref ? (
          <a
            href={postingHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("mt-0.5 block truncate text-sm", LINK_MUTED_CLASS)}
          >
            {application.role}
          </a>
        ) : (
          <p className="mt-0.5 truncate text-sm text-foreground/90">{application.role}</p>
        )}
        {metaLine ? <p className="mt-1 truncate text-xs text-muted-foreground">{metaLine}</p> : null}
      </div>
      <StatusBadge status={application.status} className="shrink-0" />
    </li>
  );
}

export function ApplicationListBlock({ result }: { result: ChatApplicationListResult }) {
  if (result.applications.length === 0) return null;

  return (
    <ChatDataCard
      title={result.title}
      actions={
        result.viewAllHref ? (
          <Link href={result.viewAllHref} className="text-xs font-medium text-primary hover:underline">
            View all →
          </Link>
        ) : undefined
      }
      padding="p-0"
    >
      <ul className="divide-y divide-border/60">
        {result.applications.map((application) => (
          <ApplicationRecordRow key={application.id} application={application} />
        ))}
      </ul>
      {result.truncated ? (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Showing {result.applications.length} of {result.totalCount}
        </div>
      ) : null}
    </ChatDataCard>
  );
}
