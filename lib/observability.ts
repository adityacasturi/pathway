type EventLevel = "info" | "warn" | "error";

type ObservabilityPayload = {
  level: EventLevel;
  event: string;
  message?: string;
  route?: string;
  code?: string;
  digest?: string;
  meta?: Record<string, string | number | boolean | null>;
};

function cleanPayload(payload: ObservabilityPayload): ObservabilityPayload {
  return {
    ...payload,
    message: payload.message?.slice(0, 500),
    meta: payload.meta
      ? Object.fromEntries(
          Object.entries(payload.meta).map(([key, value]) => [
            key.slice(0, 80),
            typeof value === "string" ? value.slice(0, 200) : value,
          ]),
        )
      : undefined,
  };
}

export function logServerEvent(payload: ObservabilityPayload): void {
  const clean = cleanPayload(payload);
  const line = JSON.stringify({
    ...clean,
    app: "pathway",
    at: new Date().toISOString(),
  });

  if (clean.level === "error") {
    console.error(line);
    return;
  }
  if (clean.level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}
