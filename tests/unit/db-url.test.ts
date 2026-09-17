import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/lib/db/url";

const TX = "postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
const SESSION = TX.replace(":6543/", ":5432/");

describe("resolveDatabaseUrl", () => {
  it("uses the transaction pooler by default, whichever pooler port the URL names", () => {
    expect(resolveDatabaseUrl(TX, undefined)).toEqual({ url: TX, mode: "transaction" });
    expect(resolveDatabaseUrl(SESSION, undefined)).toEqual({ url: TX, mode: "transaction" });
  });
  it("moves to the session pooler only when DB_POOL_MODE=session", () => {
    expect(resolveDatabaseUrl(TX, "session")).toEqual({ url: SESSION, mode: "session" });
    expect(resolveDatabaseUrl(SESSION, "session")).toEqual({ url: SESSION, mode: "session" });
  });
  it("leaves a non-Supabase URL alone and reports its mode by port", () => {
    const local = "postgres://postgres@127.0.0.1:6432/pgl_test";
    expect(resolveDatabaseUrl(local, undefined)).toEqual({ url: local, mode: "session" });
    const direct = "postgres://postgres@127.0.0.1:5432/pgl_test";
    expect(resolveDatabaseUrl(direct, undefined)).toEqual({ url: direct, mode: "session" });
  });
});
