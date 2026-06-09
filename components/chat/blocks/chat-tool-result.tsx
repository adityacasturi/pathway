"use client";

import type { ChatToolResult } from "@/lib/chat/types";
import { CompanyCardBlock } from "@/components/chat/blocks/company-card-block";
import { CompanyListBlock } from "@/components/chat/blocks/company-list-block";
import { PostingListBlock } from "@/components/chat/blocks/posting-list-block";
import { PostingCardBlock } from "@/components/chat/blocks/posting-card-block";
import { ApplicationListBlock } from "@/components/chat/blocks/application-list-block";
import { ApplicationDetailBlock } from "@/components/chat/blocks/application-detail-block";
import { ApplicationStatsBlock } from "@/components/chat/blocks/application-stats-block";
import { EmptyResultBlock } from "@/components/chat/blocks/empty-result-block";
import { BlurFade } from "@/components/magicui/blur-fade";

export function ChatToolResultBlock({
  result,
  trackedUrls,
  savedIds,
}: {
  result: ChatToolResult;
  trackedUrls: string[];
  savedIds: string[];
}) {
  return (
    <BlurFade delay={0.04} inView>
      <div className="mt-3">
        {result.presentation === "company_card" ? <CompanyCardBlock result={result} /> : null}
        {result.presentation === "company_list" ? (
          <CompanyListBlock companies={result.companies} title={result.title} />
        ) : null}
        {result.presentation === "posting_list" ? (
          <PostingListBlock result={result} trackedUrls={trackedUrls} savedIds={savedIds} />
        ) : null}
        {result.presentation === "posting_card" ? (
          <PostingCardBlock result={result} trackedUrls={trackedUrls} savedIds={savedIds} />
        ) : null}
        {result.presentation === "application_list" ? (
          <ApplicationListBlock result={result} />
        ) : null}
        {result.presentation === "application_detail" ? (
          <ApplicationDetailBlock result={result} />
        ) : null}
        {result.presentation === "application_stats" ? (
          <ApplicationStatsBlock result={result} />
        ) : null}
        {result.presentation === "empty_result" ? <EmptyResultBlock result={result} /> : null}
      </div>
    </BlurFade>
  );
}
