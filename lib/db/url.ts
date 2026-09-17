/**
 * The Supabase pooler (Supavisor) serves two modes on the same host.
 *
 * Session mode (port 5432) gives every client connection its own server connection for as long
 * as the client stays connected, and a Nano/Micro project allows only pool_size = 15 of them.
 * A serverless instance is frozen the moment its response is sent, and its idle connections
 * stay open on the pooler until the instance is reaped; a few frozen instances hold all fifteen
 * and every new request fails with "max clients reached in session mode" (EMAXCONNSESSION).
 * Production logs showed exactly that.
 *
 * Transaction mode (port 6543) hands a server connection to a client only for the duration of
 * a transaction and allows a few hundred client connections, so an idle client costs nothing.
 * That is the mode built for serverless and the app uses it (prepare=false, one statement in
 * flight per connection – see index.ts). DB_POOL_MODE=session keeps 5432 for a deliberate test.
 * Only Supabase pooler hosts are rewritten; a local URL is used as given.
 */
export function resolveDatabaseUrl(raw: string, mode = process.env.DB_POOL_MODE): { url: string; mode: "session" | "transaction" } {
  const pooler = /\.pooler\.supabase\.com:(\d+)\//.test(raw);
  const url = !pooler ? raw : mode === "session" ? raw.replace(/:6543(\/)/, ":5432$1") : raw.replace(/:5432(\/)/, ":6543$1");
  return { url, mode: /:6543\//.test(url) ? "transaction" : "session" };
}
