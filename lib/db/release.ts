/**
 * Why connections are released after every response.
 *
 * On Vercel an instance is frozen as soon as its last response is sent, so the driver's idle
 * timer never fires: whatever connections are open at that moment stay open – on the pooler,
 * counting against its limit – until the instance is reaped, and a socket reused after a
 * freeze may be dead on arrival. Next.js `after()` runs once the response has been sent and
 * keeps the instance alive until the callback settles, which is the one moment the pool can be
 * closed cleanly: the live pool is swapped for an empty one (so a request still rendering on
 * this instance carries on) and the old one is ended, closing idle connections at once and
 * busy ones as they finish. The next request opens fresh connections (tens of milliseconds
 * through the pooler in the same region).
 */
export type Scheduler = (callback: () => Promise<void>) => void;

/**
 * Returns a function to call on every statement. It arranges one release per response;
 * outside a request scope (scripts, tests, build) the scheduler throws and nothing is arranged.
 */
export function makeReleaser(schedule: Scheduler, release: () => Promise<void>): () => void {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    try {
      schedule(async () => {
        scheduled = false;
        await release();
      });
      scheduled = true;
    } catch {
      // not inside a request – idle_timeout closes the connections instead
    }
  };
}
