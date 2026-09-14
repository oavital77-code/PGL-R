import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/authorize";
import { exportInvoicesBatch, exportReceiptsBatch } from "@/lib/accounting/export";
import { getSetting } from "@/lib/settings/service";

export const dynamic = "force-dynamic";

/** /api/exports/accounting?kind=invoices|receipts&from=&to=&all=1 (spec §11.14) */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "invoices.view")) return new Response("forbidden", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const acc = await getSetting("accounting");
  const opts = { from: sp.get("from") || undefined, to: sp.get("to") || undefined, onlyNew: sp.get("all") !== "1", userId: user.id, format: acc.export_format };
  const res = sp.get("kind") === "receipts" ? await exportReceiptsBatch(opts) : await exportInvoicesBatch(opts);
  return new Response(new Uint8Array(res.file.bytes), { headers: { "content-type": res.file.mime, "content-disposition": `attachment; filename="${res.file.fileName}"`, "x-exported-count": String(res.count) } });
}
