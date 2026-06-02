import type { ReactNode } from "react";
import { SeasonPill } from "@/components/season-pill";
import type { FeedSeason } from "@/lib/feed/types";

export function MetaSeparator() {
  return <span className="shrink-0 text-muted-foreground/50">/</span>;
}

export function PostingMetaLine({
  company,
  season,
  children,
}: {
  company: string;
  season?: FeedSeason | null;
  children?: ReactNode;
}) {
  return (
    <div className="posting-meta-line">
      <span className="posting-meta-line__company">{company}</span>
      {season ? (
        <>
          <span className="meta-dot" aria-hidden />
          <SeasonPill season={season} showDot={false} className="shrink-0" />
        </>
      ) : null}
      {children ? <span className="posting-meta-line__suffix">{children}</span> : null}
    </div>
  );
}
