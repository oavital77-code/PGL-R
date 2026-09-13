import "server-only";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` (spec §2.6). */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function runCron(req: Request, name: string, job: () => Promise<unknown>): Promise<Response> {
  if (!isCronAuthorized(req)) return new Response("unauthorized", { status: 401 });
  const started = Date.now();
  try {
    const result = await job();
    console.log(`[cron:${name}] ok in ${Date.now() - started}ms`, result);
    return Response.json({ ok: true, job: name, ms: Date.now() - started, result });
  } catch (e) {
    console.error(`[cron:${name}] failed`, e);
    return Response.json({ ok: false, job: name, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
