import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { importBatches } from "@/lib/db/schema";
import { buildErrorReport } from "@/lib/import/templates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "import.run")) return new Response("forbidden", { status: 403 });
  const id = new URL(req.url).searchParams.get("batch") ?? "";
  const [b] = await db.select({ log: importBatches.log }).from(importBatches).where(eq(importBatches.id, id));
  if (!b) return new Response("not found", { status: 404 });
  const rows = ((b.log as { rows?: { rowNumber: number; errors: string[]; values: Record<string, unknown> }[] }).rows ?? []).filter((r) => r.errors.length);
  const bytes = await buildErrorReport(rows);
  return new Response(new Uint8Array(bytes), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="import_errors.xlsx"` } });
}
