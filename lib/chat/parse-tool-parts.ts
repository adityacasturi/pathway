import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ChatToolResult } from "./types.ts";

export function isSubstantiveToolResult(result: ChatToolResult): boolean {
  switch (result.presentation) {
    case "company_card":
    case "application_detail":
    case "application_stats":
    case "empty_result":
    case "posting_card":
      return true;
    case "company_list":
      return result.companies.length > 0;
    case "posting_list":
      return result.postings.length > 0;
    case "application_list":
      return result.applications.length > 0;
  }
}

export function shouldRenderToolResult(result: ChatToolResult): boolean {
  return isSubstantiveToolResult(result);
}

export function getToolResultRenderKey(result: ChatToolResult): string {
  switch (result.presentation) {
    case "company_card":
      return [result.presentation, result.company.slug].join(":");
    case "company_list":
      return [
        result.presentation,
        result.title ?? "",
        ...result.companies.map((company) => company.slug),
      ].join(":");
    case "posting_list":
      return [
        result.presentation,
        result.title,
        ...result.postings.map((posting) => posting.id),
      ].join(":");
    case "posting_card":
      return [result.presentation, result.posting.id].join(":");
    case "application_list":
      return [
        result.presentation,
        result.title,
        ...result.applications.map((application) => application.id),
      ].join(":");
    case "application_detail":
      return [result.presentation, result.application.id].join(":");
    case "application_stats":
      return [result.presentation, String(result.activeCount)].join(":");
    case "empty_result":
      return [result.presentation, result.kind, result.title, result.searchSummary ?? ""].join(":");
  }
}

export function filterVisibleToolResults(results: ChatToolResult[]): ChatToolResult[] {
  const visible: ChatToolResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (!shouldRenderToolResult(result)) continue;

    const key = getToolResultRenderKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    visible.push(result);
  }

  return visible;
}

export function extractToolResultsFromMessage(message: UIMessage): ChatToolResult[] {
  const results: ChatToolResult[] = [];

  for (const part of message.parts) {
    if (!isToolUIPart(part)) continue;
    if (part.state !== "output-available") continue;
    if (!part.output || typeof part.output !== "object") continue;
    const output = part.output as ChatToolResult;
    if ("presentation" in output) {
      results.push(output);
    }
  }

  return filterVisibleToolResults(results);
}

export function toolStatusLabel(part: UIMessage["parts"][number]): string | null {
  if (!isToolUIPart(part)) return null;
  const name = getToolName(part);
  if (part.state === "output-available" || part.state === "output-error") {
    return null;
  }

  switch (name) {
    case "searchRoles":
      return "Searching roles…";
    case "searchCompanies":
    case "getCompany":
      return "Searching companies…";
    case "searchApplications":
    case "getApplication":
    case "getApplicationStats":
      return "Checking your applications…";
    case "listSavedRoles":
      return "Loading saved roles…";
    default:
      return "Working…";
  }
}
