import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/authorize";
import { getEntity } from "@/lib/import/spec";
import { buildTemplate } from "@/lib/import/templates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "import.run")) return new Response("forbidden", { status: 403 });
  const key = new URL(req.url).searchParams.get("entity") ?? "";
  const entity = getEntity(key);
  if (!entity) return new Response("unknown entity", { status: 404 });
  const bytes = await buildTemplate(entity);
  return new Response(new Uint8Array(bytes), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="import_${entity.key}.xlsx"` } });
}
