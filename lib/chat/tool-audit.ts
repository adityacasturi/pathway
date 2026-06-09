import type { ToolExecutionOptions } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatToolAuditSummary, ChatToolResult } from "./types.ts";

const REDACTED_KEY_PATTERN = /(^|_)(user|auth|token|secret|password|key|session)(_|$)|userId|authUid/i;

export type ChatToolAuditContext = {
  userId: string;
  threadId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function redactToolInput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactToolInput);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      REDACTED_KEY_PATTERN.test(key) ? "[redacted]" : redactToolInput(entry),
    ]),
  );
}

export function summarizeToolResultForAudit(result: ChatToolResult): ChatToolAuditSummary {
  if (result.presentation === "posting_list") {
    return {
      presentation: result.presentation,
      title: result.title,
      totalCount: result.totalCount,
      itemCount: result.postings.length,
      truncated: result.truncated,
    };
  }

  if (result.presentation === "company_list") {
    return {
      presentation: result.presentation,
      title: result.title,
      itemCount: result.companies.length,
    };
  }

  if (result.presentation === "application_list") {
    return {
      presentation: result.presentation,
      title: result.title,
      totalCount: result.totalCount,
      itemCount: result.applications.length,
      truncated: result.truncated,
    };
  }

  if (result.presentation === "application_stats") {
    return {
      presentation: result.presentation,
      totalCount: result.activeCount,
      itemCount: Object.values(result.stageCounts).filter((count) => count > 0).length,
    };
  }

  if (result.presentation === "application_detail") {
    return {
      presentation: result.presentation,
      title: result.application.company,
      itemCount: result.events.length,
    };
  }

  if (result.presentation === "posting_card") {
    return {
      presentation: result.presentation,
      title: result.posting.company,
      itemCount: 1,
    };
  }

  if (result.presentation === "empty_result") {
    return {
      presentation: result.presentation,
      title: result.title,
      itemCount: result.suggestions.length,
    };
  }

  if (result.presentation === "company_card") {
    return {
      presentation: result.presentation,
      title: result.company.name,
      itemCount: 1,
    };
  }

  const _exhaustive: never = result;
  return _exhaustive;
}

async function insertToolAuditRow(
  supabase: SupabaseClient,
  row: {
    user_id: string;
    thread_id: string;
    tool_call_id: string | null;
    tool_name: string;
    args: unknown;
    result_summary: unknown;
    latency_ms: number;
    error: string | null;
  },
) {
  const { error } = await supabase.from("chat_tool_calls").insert(row);
  if (error) {
    console.error("Failed to audit Scout tool call", error);
  }
}

export async function auditChatToolExecution<TInput, TResult extends ChatToolResult>(
  supabase: SupabaseClient,
  context: ChatToolAuditContext | undefined,
  toolName: string,
  input: TInput,
  options: ToolExecutionOptions,
  execute: () => Promise<TResult>,
): Promise<TResult> {
  if (!context) {
    return execute();
  }

  const started = performance.now();
  try {
    const result = await execute();
    await insertToolAuditRow(supabase, {
      user_id: context.userId,
      thread_id: context.threadId,
      tool_call_id: options.toolCallId ?? null,
      tool_name: toolName,
      args: redactToolInput(input),
      result_summary: summarizeToolResultForAudit(result),
      latency_ms: Math.max(0, Math.round(performance.now() - started)),
      error: null,
    });
    return result;
  } catch (error) {
    await insertToolAuditRow(supabase, {
      user_id: context.userId,
      thread_id: context.threadId,
      tool_call_id: options.toolCallId ?? null,
      tool_name: toolName,
      args: redactToolInput(input),
      result_summary: null,
      latency_ms: Math.max(0, Math.round(performance.now() - started)),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

type ExecutableTool = {
  execute?: (input: unknown, options: ToolExecutionOptions) => unknown;
};

export function withChatToolAudit<TTools extends Record<string, unknown>>(
  supabase: SupabaseClient,
  tools: TTools,
  context?: ChatToolAuditContext,
): TTools {
  if (!context) return tools;

  return Object.fromEntries(
    Object.entries(tools).map(([name, currentTool]) => {
      const executableTool = currentTool as ExecutableTool;
      if (!executableTool.execute) return [name, currentTool];
      const execute = executableTool.execute;
      return [
        name,
        {
          ...(currentTool as object),
          execute: (input: unknown, options: ToolExecutionOptions) =>
            auditChatToolExecution(supabase, context, name, input, options, () =>
              Promise.resolve(execute(input, options) as ChatToolResult),
            ),
        },
      ];
    }),
  ) as TTools;
}
