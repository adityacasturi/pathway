import { logServerEvent } from "@/lib/observability";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export type ResendFailureKind = "config" | "rate_limit" | "quota" | "invalid" | "transient";

export type ResendSendResult =
  | { ok: true }
  | { ok: false; kind: ResendFailureKind; error: string; status?: number };

const RESEND_TIMEOUT_MS = 10_000;

export function classifyResendFailure(status: number, body: string): ResendFailureKind {
  const normalized = body.toLowerCase();

  if (status === 429 || normalized.includes("rate limit")) {
    return "rate_limit";
  }
  if (
    status === 402 ||
    normalized.includes("quota") ||
    normalized.includes("daily limit") ||
    normalized.includes("limit exceeded")
  ) {
    return "quota";
  }
  if (status === 422 || status === 400) {
    return "invalid";
  }
  if (status >= 500) {
    return "transient";
  }
  return "transient";
}

export function shouldStopResendBatch(kind: ResendFailureKind): boolean {
  return kind === "rate_limit" || kind === "quota";
}

export async function sendResendEmail(input: SendEmailInput): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return { ok: false, kind: "config", error: "Email is not configured." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const kind = classifyResendFailure(response.status, body);
      return {
        ok: false,
        kind,
        status: response.status,
        error: body || `Resend HTTP ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend request failed";
    return { ok: false, kind: "transient", error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

export function logResendFailure(
  result: Extract<ResendSendResult, { ok: false }>,
  event: string,
  meta?: Record<string, string | number | boolean | null>,
): void {
  logServerEvent({
    level: "warn",
    event,
    message: result.error,
    meta: {
      kind: result.kind,
      status: result.status ?? null,
      ...meta,
    },
  });
}
