import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/lib/db/url";

const T = "postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

describe("resolveDatabaseUrl", () => {
  it("moves a transaction-pooler URL to the session pooler on the same host", () => {
    expect(resolveDatabaseUrl(T, undefined)).toEqual({ url: T.replace(":6543/", ":5432/"), mode: "session" });
  });
  it("keeps the URL when DB_POOL_MODE=transaction", () => {
    expect(resolveDatabaseUrl(T, "transaction")).toEqual({ url: T, mode: "transaction" });
  });
  it("leaves any other URL alone", () => {
    const local = "postgres://postgres@127.0.0.1:5433/pgl_test";
    expect(resolveDatabaseUrl(local, undefined)).toEqual({ url: local, mode: "session" });
  });
});
