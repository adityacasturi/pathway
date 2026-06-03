import {
  logResendFailure,
  sendResendEmail,
  shouldStopResendBatch,
  type ResendSendResult,
} from "@/lib/email/resend-client";
import { logServerEvent } from "@/lib/observability";

const RESEND_BATCH_GAP_MS = 250;

export type ResendBatchStopReason = "rate_limit" | "quota";

export type ResendBatchResult = {
  sent: number;
  errors: number;
  stoppedReason?: ResendBatchStopReason;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopReasonFromKind(
  kind: Extract<ResendSendResult, { ok: false }>["kind"],
): ResendBatchStopReason | undefined {
  if (kind === "quota") return "quota";
  if (kind === "rate_limit") return "rate_limit";
  return undefined;
}

export async function pauseBetweenResendSends(): Promise<void> {
  await sleep(RESEND_BATCH_GAP_MS);
}

export function handleResendBatchFailure(
  result: Extract<ResendSendResult, { ok: false }>,
  event: string,
  meta?: Record<string, string | number | boolean | null>,
): ResendBatchStopReason | undefined {
  logResendFailure(result, event, meta);
  if (!shouldStopResendBatch(result.kind)) {
    return undefined;
  }

  const stoppedReason = stopReasonFromKind(result.kind);
  if (stoppedReason) {
    logServerEvent({
      level: "warn",
      event: "resend.batch_stopped",
      message: `Stopped outbound email batch after ${stoppedReason}`,
      meta: { stoppedReason, ...meta },
    });
  }
  return stoppedReason;
}
