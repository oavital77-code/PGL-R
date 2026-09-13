import { runCron } from "@/lib/cron/guard";
import { invoiceAgingJob } from "@/lib/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return runCron(req, "invoice-aging", invoiceAgingJob);
}
