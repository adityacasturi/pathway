import { logServerEvent } from "@/lib/observability";

export function register() {
  logServerEvent({
    level: "info",
    event: "server.boot",
    meta: {
      runtime: process.env.NEXT_RUNTIME ?? "unknown",
      nodeEnv: process.env.NODE_ENV ?? "unknown",
    },
  });
}
