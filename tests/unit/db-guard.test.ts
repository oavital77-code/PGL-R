import { describe, expect, it } from "vitest";
import { DbTimeoutError, guardUnsafe, isConnectionFailure, isRetriableRead, type PendingLike } from "@/lib/db/guard";

/** Mirrors the driver: Query.cancel() returns null, never a promise. */
function hanging(): PendingLike {
  const p = new Promise<never>(() => undefined) as Promise<never> & PendingLike;
  p.cancel = (() => null) as unknown as () => Promise<unknown>;
  p.values = () => p;
  return p;
}
function failing(code: string): PendingLike {
  const p = Promise.reject(Object.assign(new Error(code), { code })) as Promise<never> & PendingLike;
  p.catch(() => undefined);
  p.values = () => p;
  return p;
}
function answering(rows: unknown): PendingLike {
  const p = Promise.resolve(rows) as Promise<unknown> & PendingLike;
  p.values = () => p;
  return p;
}

describe("query guard", () => {
  it("classifies reads", () => {
    expect(isRetriableRead("select 1")).toBe(true);
    expect(isRetriableRead("  WITH x AS (select 1) select * from x")).toBe(true);
    expect(isRetriableRead("insert into t values (1)")).toBe(false);
    expect(isRetriableRead("update t set a = 1")).toBe(false);
  });

  it("abandons a hung read after the timeout, resets the pool and re-issues it once", async () => {
    let resets = 0;
    let calls = 0;
    const pool = { unsafe: () => (++calls === 1 ? hanging() : answering([{ ok: 1 }])) };
    const unsafe = guardUnsafe(() => pool, async () => void resets++, 30);
    const rows = await unsafe("select 1");
    expect(rows).toEqual([{ ok: 1 }]);
    expect(resets).toBe(1);
    expect(calls).toBe(2);
  });

  it("re-issues through .values() as well", async () => {
    let calls = 0;
    const pool = { unsafe: () => (++calls === 1 ? hanging() : answering([[7]])) };
    const unsafe = guardUnsafe(() => pool, async () => undefined, 30);
    expect(await unsafe("select 7").values!()).toEqual([[7]]);
    expect(calls).toBe(2);
  });

  it("never re-issues a write: it resets the pool and surfaces the timeout", async () => {
    let resets = 0;
    let calls = 0;
    const pool = { unsafe: () => (++calls, hanging()) };
    const unsafe = guardUnsafe(() => pool, async () => void resets++, 30);
    await expect(unsafe("insert into t values (1)")).rejects.toBeInstanceOf(DbTimeoutError);
    expect(resets).toBe(1);
    expect(calls).toBe(1);
  });

  it("gives up after one retry", async () => {
    let calls = 0;
    const pool = { unsafe: () => (++calls, hanging()) };
    const unsafe = guardUnsafe(() => pool, async () => undefined, 30);
    await expect(unsafe("select 1")).rejects.toBeInstanceOf(DbTimeoutError);
    expect(calls).toBe(2);
  });

  it("passes driver errors through untouched", async () => {
    const pool = { unsafe: () => Promise.reject(new Error("syntax error")) as unknown as PendingLike };
    const unsafe = guardUnsafe(() => pool, async () => undefined, 30);
    await expect(unsafe("select 1")).rejects.toThrow("syntax error");
  });

  it("re-issues a read whose connection could not be opened (CONNECT_TIMEOUT) on a fresh pool", async () => {
    let resets = 0;
    let calls = 0;
    const pool = { unsafe: () => (++calls === 1 ? failing("CONNECT_TIMEOUT") : answering([{ ok: 1 }])) };
    const unsafe = guardUnsafe(() => pool, async () => void resets++, 30);
    expect(await unsafe("select 1")).toEqual([{ ok: 1 }]);
    expect(resets).toBe(1);
    expect(calls).toBe(2);
  });

  it("never re-issues a write after a connection failure: it resets and surfaces the error", async () => {
    let resets = 0;
    let calls = 0;
    const pool = { unsafe: () => (++calls, failing("CONNECTION_CLOSED")) };
    const unsafe = guardUnsafe(() => pool, async () => void resets++, 30);
    await expect(unsafe("update t set x = 1")).rejects.toMatchObject({ code: "CONNECTION_CLOSED" });
    expect(resets).toBe(1);
    expect(calls).toBe(1);
  });

  it("classifies connection failures and nothing else", () => {
    expect(isConnectionFailure(Object.assign(new Error(), { code: "CONNECT_TIMEOUT" }))).toBe(true);
    expect(isConnectionFailure(Object.assign(new Error(), { code: "ECONNRESET" }))).toBe(true);
    expect(isConnectionFailure(Object.assign(new Error(), { code: "42601" }))).toBe(false);
    expect(isConnectionFailure(new Error("x"))).toBe(false);
    expect(isConnectionFailure(null)).toBe(false);
  });
});
