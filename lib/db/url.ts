/**
 * The Supabase pooler serves two modes on the same host: transaction mode on 6543 and session
 * mode on 5432. Transaction mode multiplexes many clients over few server connections by
 * re-sequencing protocol messages; production logs showed it handing one statement the
 * parameters of another ("invalid input syntax for type uuid: 'f'") and leaving statements
 * without a reply. Session mode is a plain one-client-one-server relay with none of that, and
 * a handful of office users never approaches its connection limit. Unless DB_POOL_MODE is set
 * to "transaction", a 6543 URL is rewritten to 5432.
 */
export function resolveDatabaseUrl(raw: string, mode = process.env.DB_POOL_MODE): { url: string; mode: "session" | "transaction" } {
  if (mode === "transaction") return { url: raw, mode };
  const url = raw.replace(/:6543(\/)/, ":5432$1");
  return { url, mode: url === raw && /:6543/.test(raw) ? "transaction" : "session" };
}
