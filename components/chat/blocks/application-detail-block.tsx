"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { ChatInsetCard } from "@/components/chat/chat-panel";
import { SeasonBadge } from "@/components/season-badge";
import { EventDot, StatusBadge } from "@/components/status-badge";
import type { ChatApplicationDetailResult } from "@/lib/chat/types";
import { formatCompactLocationLabel } from "@/lib/feed/us-locations";
import { safeExternalHref } from "@/lib/url";
import { LINK_MUTED_CLASS } from "@/lib/ui/link-styles";
import { cn, formatDate } from "@/lib/utils";

export function ApplicationDetailBlock({ result }: { result: ChatApplicationDetailResult }) {
  const { application, events, applicationsHref } = result;
  const postingHref = safeExternalHref(application.postingUrl);
  const locationLabel = application.location
    ? formatCompactLocationLabel(application.location, 2)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">Application</p>
        <Link
          href={applicationsHref}
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary opacity-80 transition-opacity hover:opacity-100"
        >
          Applications
          <ArrowUpRight size={12} aria-hidden />
        </Link>
      </div>

      <ChatInsetCard className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <CompanyLogo company={application.company} size={40} lazy />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{application.company}</p>
              {application.season ? (
                <SeasonBadge season={application.season} variant="plain" className="shrink-0" />
              ) : null}
              <StatusBadge status={application.status} className="shrink-0" />
            </div>
            {postingHref ? (
              <a
                href={postingHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("mt-1 block truncate text-sm", LINK_MUTED_CLASS)}
              >
                {application.role}
              </a>
            ) : (
              <p className="mt-1 truncate text-sm text-foreground/90">{application.role}</p>
            )}
            {locationLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">{locationLabel}</p>
            ) : null}
            {application.appliedDate ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Applied {formatDate(application.appliedDate)}
              </p>
            ) : null}
          </div>
        </div>

        {events.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Timeline
            </p>
            <ol className="space-y-2">
              {events.map((event) => (
                  <li key={event.id} className="flex items-start gap-2.5">
                    <span className="mt-1.5 shrink-0">
                      <EventDot type={event.eventType} size={8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-foreground">{event.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(event.eventDate)}
                        </span>
                      </div>
                      {event.notes ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{event.notes}</p>
                      ) : null}
                    </div>
                  </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
        )}
      </ChatInsetCard>
    </div>
  );
}
