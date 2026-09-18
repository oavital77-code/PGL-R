/**
 * Bounds every statement the driver sends and recovers from a dead pooled connection.
 *
 * Production pattern (Vercel + Supabase pooler): the first statement on a page opened after a
 * pause never gets a reply – the socket died while the instance was frozen and was reused before
 * its own idle timer could close it. The statement is abandoned after `timeoutMs`, the pool is
 * rebuilt, and a read-only statement is re-issued once on the fresh pool so the page still renders.
 * Writes are never re-issued automatically.
 */
export class DbTimeoutError extends Error {
  constructor(ms: number) {
    super(`database query exceeded ${ms}ms`);
    this.name = "DbTimeoutError";
  }
}

export interface PendingLike extends PromiseLike<unknown> {
  cancel?: () => Promise<unknown>;
  values?: () => PromiseLike<unknown>;
  raw?: () => PromiseLike<unknown>;
  execute?: () => PromiseLike<unknown>;
  describe?: () => PromiseLike<unknown>;
}
export type Unsafe = (query: string, params?: unknown[], options?: unknown) => PendingLike;

/**
 * A statement that failed because its connection could not be opened or died under it never
 * reached the server, so re-issuing it is as safe as a timeout retry. These are the driver's
 * own connection error codes; server errors (syntax, constraint …) are never in this set.
 */
const CONNECTION_FAILURES = new Set(["CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_DESTROYED", "CONNECTION_ENDED", "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"]);
export function isConnectionFailure(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && CONNECTION_FAILURES.has(String((e as { code: unknown }).code));
}

/** SELECT / WITH … SELECT statements are safe to send twice; anything else is not. */
export function isRetriableRead(query: string): boolean {
  return /^\s*(select|with)\b/i.test(query);
}

/** Statements slower than this are logged with their text, so a stall can be attributed. */
export const SLOW_STATEMENT_MS = 2_000;

function timed<T>(p: PromiseLike<T>, ms: number, onTimeout: () => void, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      console.error(`[db] no reply after ${ms}ms: ${label}`);
      onTimeout();
      reject(new DbTimeoutError(ms));
    }, ms);
  });
  return Promise.race([Promise.resolve(p), guard]).finally(() => {
    clearTimeout(timer);
    const took = Date.now() - started;
    if (took >= SLOW_STATEMENT_MS && took < ms) console.warn(`[db] slow ${took}ms: ${label}`);
  });
}

/**
 * Returns an `unsafe` replacement. `current()` must always yield the live driver (it changes
 * after `reset()`), and `reset()` must replace the pool and resolve once the new one is usable.
 */
export function guardUnsafe(current: () => { unsafe: Unsafe }, reset: (reason: string) => Promise<void>, timeoutMs: number): Unsafe {
  const attempt = (query: string, params?: unknown[], options?: unknown, retriesLeft = 1): PendingLike => {
    const pending = current().unsafe(query, params, options);
    const label = query.replace(/\s+/g, " ").trim().slice(0, 120);
    // Query.cancel() returns null (the driver's cancel promise is discarded), so nothing here
    // may assume a promise back. Throwing from a timer callback would crash the process.
    const lost = () => {
      try {
        const r = pending.cancel?.() as unknown;
        if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch(() => undefined);
      } catch {
        // already gone
      }
    };
    const run = <T>(p: PromiseLike<T>, method?: keyof PendingLike): Promise<T> =>
      timed(p, timeoutMs, lost, label).catch(async (e: unknown) => {
        const reason = e instanceof DbTimeoutError ? "query timeout" : isConnectionFailure(e) ? `connection ${(e as { code: string }).code}` : null;
        if (!reason) throw e;
        await reset(reason);
        if (retriesLeft > 0 && isRetriableRead(query)) {
          const again = attempt(query, params, options, retriesLeft - 1);
          const fn = method ? (again[method] as (() => PromiseLike<T>) | undefined) : undefined;
          return (fn ? fn.call(again) : again) as PromiseLike<T>;
        }
        throw e;
      });
    // The timer must start only when the statement is actually consumed – either awaited
    // directly or through one of the driver's result methods – never for both at once.
    let base: Promise<unknown> | undefined;
    const settle = () => (base ??= run(pending));
    const wrapped: PendingLike & { catch: Promise<unknown>["catch"]; finally: Promise<unknown>["finally"] } = {
      then: (onFulfilled, onRejected) => settle().then(onFulfilled, onRejected),
      catch: (onRejected) => settle().catch(onRejected),
      finally: (onFinally) => settle().finally(onFinally),
      cancel: pending.cancel ? () => pending.cancel!() : undefined,
    };
    for (const m of ["values", "raw", "execute", "describe"] as const) {
      const fn = pending[m];
      if (typeof fn === "function") wrapped[m] = () => run(fn.call(pending), m);
    }
    return wrapped;
  };
  return (query, params, options) => attempt(query, params, options);
}
