"use client";

import type { MouseEvent } from "react";
import { Archive } from "lucide-react";
import { Application } from "@/types/application";
import { cn, formatDate } from "@/lib/utils";
import { safeExternalHref } from "@/lib/url";
import { CompanyLogo } from "@/components/company-logo";
import {
  lookupCompanyWebsiteUrl,
  type CompanyWebsiteByName,
} from "@/lib/logo/company-website-lookup";
import { MetaSeparator, PostingMetaLine } from "@/components/posting-meta-line";
import { StatusBadge } from "@/components/status-badge";

interface Props {
  application: Application;
  companyWebsiteByName?: CompanyWebsiteByName;
  archived: boolean;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent) => void;
}

export function ApplicationRow({
  application,
  companyWebsiteByName = {},
  archived,
  onOpen,
  onContextMenu,
}: Props) {
  const postingHref = safeExternalHref(application.posting_url);
  const locationLabel = application.location?.trim() ?? "";
  const activityLabel = formatDate(application.last_activity_date);
  const showAside = Boolean(locationLabel || activityLabel);

  return (
    <li
      data-testid="application-row"
      data-company={application.company}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      className={cn(archived && "opacity-60")}
    >
      <div
        className={cn(
          "group flex cursor-pointer select-none items-center gap-4 rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:bg-muted/30",
        )}
      >
        <CompanyLogo
          company={application.company}
          websiteUrl={lookupCompanyWebsiteUrl(application.company, companyWebsiteByName)}
          size={36}
        />

        <div className="min-w-0 flex-1">
          <PostingMetaLine company={application.company} season={application.season}>
            {archived ? (
              <>
                <MetaSeparator />
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Archive size={9} strokeWidth={1.75} />
                  Archived
                </span>
              </>
            ) : null}
          </PostingMetaLine>

          <div className="mt-1.5 min-w-0">
            {postingHref ? (
              <a
                href={postingHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                title={`Open posting: ${application.posting_url}`}
                className="inline-block max-w-full truncate text-[15px] font-medium text-foreground decoration-muted-foreground/40 underline-offset-4 transition-colors duration-150 hover:text-primary hover:underline"
              >
                {application.role}
              </a>
            ) : (
              <p className="truncate text-[15px] font-medium text-foreground">{application.role}</p>
            )}
          </div>

          {showAside ? (
            <p className="mt-1 truncate text-[13px] text-muted-foreground md:hidden">
              {[locationLabel, activityLabel].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        {showAside ? (
          <div className="hidden min-w-0 shrink-0 flex-col items-end gap-0.5 text-right md:flex md:max-w-[11rem]">
            {locationLabel ? (
              <span className="w-full truncate text-[13px] font-normal text-foreground/72">
                {locationLabel}
              </span>
            ) : null}
            {activityLabel ? (
              <span className="w-full truncate text-[12px] tabular-nums text-muted-foreground">
                {activityLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <StatusBadge status={application.status} variant="compact" />
      </div>
    </li>
  );
}
