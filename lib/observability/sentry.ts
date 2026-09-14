import "server-only";
import { createHash } from "node:crypto";

/**
 * Dependency-free Sentry reporter (spec §17 – optional SENTRY_DSN). Sends an event envelope to the
 * Sentry store endpoint; silently no-ops when the DSN is not configured.
 */
export async function reportError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  console.error(error, context);
  if (!dsn) return;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    const key = u.username;
    const endpoint = `${u.protocol}//${u.host}/api/${projectId}/envelope/`;
    const err = error instanceof Error ? error : new Error(String(error));
    const eventId = createHash("md5").update(`${Date.now()}${Math.random()}`).digest("hex");
    const event = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: "node",
      level: "error",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      exception: { values: [{ type: err.name, value: err.message, stacktrace: { frames: (err.stack ?? "").split("\n").slice(1, 30).map((l) => ({ function: l.trim() })) } }] },
      extra: context,
    };
    const envelope = `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
    await fetch(endpoint, { method: "POST", headers: { "content-type": "application/x-sentry-envelope", "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${key}, sentry_client=pgl-r/1.0` }, body: envelope });
  } catch {
    /* never fail the caller because of telemetry */
  }
}
