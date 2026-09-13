import { runCron } from "@/lib/cron/guard";
import { cbsIndexFetchJob } from "@/lib/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return runCron(req, "cbs-index-fetch", cbsIndexFetchJob);
}
