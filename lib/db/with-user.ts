import "server-only";
import { sql } from "drizzle-orm";
import { db, type Tx } from "./index";

export interface ActingContext {
  userId: string | null;
  requestId?: string;
  /** Reason for sensitive actions – persisted in audit via app.reason (spec §14) */
  reason?: string;
}

/**
 * Run `fn` inside a transaction with the acting user set for the audit triggers:
 *   SET LOCAL app.user_id / app.request_id / app.reason
 */
export async function withUser<T>(ctx: ActingContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (ctx.userId) await tx.execute(sql`select set_config('app.user_id', ${ctx.userId}, true)`);
    await tx.execute(sql`select set_config('app.request_id', ${ctx.requestId ?? crypto.randomUUID()}, true)`);
    if (ctx.reason) await tx.execute(sql`select set_config('app.reason', ${ctx.reason}, true)`);
    return fn(tx);
  });
}
