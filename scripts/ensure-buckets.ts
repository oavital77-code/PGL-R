/**
 * Creates the private Supabase Storage buckets the app uses (spec §2.4).
 * Idempotent – existing buckets are left untouched.
 *   pnpm storage:init
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { BUCKETS } from "../lib/storage/buckets";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.storage.listBuckets();
  if (error) throw error;
  const existing = new Set((data ?? []).map((b) => b.name));
  for (const bucket of BUCKETS) {
    if (existing.has(bucket)) {
      console.log(`= ${bucket}`);
      continue;
    }
    const { error: createError } = await sb.storage.createBucket(bucket, { public: false });
    if (createError) throw createError;
    console.log(`+ ${bucket}`);
  }
  console.log("buckets ready");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
