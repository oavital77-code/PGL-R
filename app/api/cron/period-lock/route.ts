import { runCron } from "@/lib/cron/guard";
import { periodLockJob } from "@/lib/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return runCron(req, "period-lock", periodLockJob);
}
