import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, supplierInvoices } from "@/lib/db/schema";
import { contractBalancesReport } from "@/lib/reports/balances";
import { getSetting } from "@/lib/settings/service";
import { adminUserIds } from "@/lib/notifications/service";
import { notifyEvent } from "@/lib/email/notify-email";

/** Contract progress (80/100%) and supplier alerts, once per crossing (spec §8.4, §13.2). */
export async function contractAlertsJob() {
  const [alerts, sup] = await Promise.all([getSetting("alerts"), getSetting("suppliers")]);
  const admins = await adminUserIds();
  const rep = await contractBalancesReport({ activeOnly: true });
  const pms = new Map((await db.select({ id: projects.id, pm: projects.projectManagerUserId }).from(projects)).map((p) => [p.id, p.pm]));
  let count = 0;
  for (const p of rep.projects) {
    const targets = [...new Set([...admins, ...(pms.get(p.id) ? [pms.get(p.id)!] : [])])];
    const clientPct = p.balances.progressPct ?? 0;
    for (const c of p.contracts) {
      if (c.direction === "income") {
        const pct = c.balances.progressPct;
        if (pct === null) continue;
        for (const th of alerts.contract_progress_thresholds) {
          if (pct >= th) {
            const ids = await notifyEvent({ userIds: targets, type: "contract.progress", title: `חוזה ${c.numberInProject} בפרויקט ${p.workNumber} הגיע ל-${th}% הגשה`, link: `/contracts/${c.id}`, dedupeKey: `contract.progress:${c.id}:${th}` });
            count += ids.length ? 1 : 0;
          }
        }
      } else {
        const sis = await db.select().from(supplierInvoices).where(and(eq(supplierInvoices.contractId, c.id), isNull(supplierInvoices.deletedAt), inArray(supplierInvoices.status, ["pending", "partially_approved", "approved", "paid"])));
        const budget = c.balances.totalAmount ?? 0;
        if (sup.over_budget_alert && budget > 0 && c.supplierCost > budget) {
          const ids = await notifyEvent({ userIds: targets, type: "supplier.over_budget", title: `ספק חרג מתקציב בחוזה ${c.numberInProject} – ${p.workNumber}`, body: `אושר ${c.supplierCost} מול תקציב ${budget}`, link: `/contracts/${c.id}`, dedupeKey: `supplier.over_budget:${c.id}:${Math.floor(c.supplierCost)}` });
          count += ids.length ? 1 : 0;
        }
        const claimed = sis.reduce((a, s) => a + Number(s.progressPctClaimed ?? 0), 0);
        if (sup.progress_vs_client_alert && claimed > clientPct + 0.0005 && claimed > 0) {
          const ids = await notifyEvent({ userIds: targets, type: "supplier.progress_vs_client", title: `ביצוע ספק (${claimed.toFixed(1)}%) גבוה מחיוב ללקוח (${clientPct.toFixed(1)}%) – ${p.workNumber}`, link: `/contracts/${c.id}`, dedupeKey: `supplier.progress_vs_client:${c.id}:${Math.floor(claimed)}` });
          count += ids.length ? 1 : 0;
        }
      }
    }
  }
  return { alerts: count };
}
