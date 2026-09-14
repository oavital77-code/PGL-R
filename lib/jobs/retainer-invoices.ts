import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contractStatuses, contracts, invoiceLines, invoices, projects, subContracts, users } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { getSetting, getSettingFresh } from "@/lib/settings/service";
import { todayLocal } from "@/lib/i18n/format";
import { allocateInvoiceNumber, nextPartialNumber } from "@/lib/invoices/numbering";
import { buildRetainerLines, loadSubContractContexts, recomputeInvoice } from "@/lib/invoices/build";
import { notify } from "@/lib/notifications/service";

/** On the billing day create a draft per active retainer sub-contract without an invoice for this month (spec §11.6.3). */
export async function retainerInvoicesJob() {
  const today = todayLocal();
  const day = Number(today.slice(8, 10));
  const month = `${today.slice(0, 7)}-01`;
  const invSettings = await getSetting("invoices");
  const scs = await db
    .select({ sc: subContracts, contractId: contracts.id, projectName: projects.name, clientId: contracts.clientId, payingClientId: contracts.payingClientId, retentionPct: contracts.retentionPct })
    .from(subContracts)
    .innerJoin(contracts, eq(contracts.id, subContracts.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .leftJoin(contractStatuses, eq(contractStatuses.id, subContracts.statusId))
    .where(and(eq(subContracts.pricingMethod, "retainer"), isNull(subContracts.deletedAt), isNull(contracts.deletedAt), eq(contracts.direction, "income"), sql`coalesce(${contractStatuses.isTerminal}, false) = false`));
  let created = 0;
  const createdIds: string[] = [];
  const [actor] = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true))).limit(1);
  if (!actor) return { created: 0, skipped: "no_admin" };
  for (const row of scs) {
    const sc = row.sc;
    const billingDay = sc.retainerBillingDay ?? invSettings.retainer_billing_day;
    if (day !== billingDay) continue;
    if (sc.retainerStart && sc.retainerStart > today) continue;
    if (sc.retainerEnd && sc.retainerEnd < month) continue;
    const [exists] = await db
      .select({ id: invoiceLines.id })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(and(eq(invoiceLines.subContractId, sc.id), eq(invoiceLines.lineType, "retainer"), eq(invoiceLines.retainerMonth, month), sql`${invoices.status} <> 'cancelled'`))
      .limit(1);
    if (exists) continue;
    const id = await withUser({ userId: actor.id }, async (tx) => {
      const num = await allocateInvoiceNumber(tx, actor.id, today);
      const partial = await nextPartialNumber(tx, row.contractId);
      const settings = await getSettingFresh("invoices", tx);
      const [inv] = await tx
        .insert(invoices)
        .values({ invoiceNumber: num.invoiceNumber, sequenceNo: num.sequenceNo, sequenceYear: num.sequenceYear, contractId: row.contractId, clientId: row.clientId!, payingClientId: row.payingClientId, partialNumber: partial, status: "draft", invoiceDate: today, periodFrom: month, periodTo: month, subject: row.projectName, introText: settings.default_intro_text, retentionPct: row.retentionPct })
        .returning({ id: invoices.id });
      const [ctx] = await loadSubContractContexts(tx, [sc.id]);
      const lines = buildRetainerLines(ctx!, month, month, 1);
      if (lines.length) await tx.insert(invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: inv!.id })));
      await recomputeInvoice(tx, inv!.id);
      return inv!.id;
    });
    created++;
    createdIds.push(id);
  }
  if (created > 0) {
    const admins = await db.select({ id: users.id }).from(users).where(and(inArray(users.role, ["admin"]), eq(users.isActive, true)));
    await notify({ userIds: admins.map((a) => a.id), type: "invoice.retainer_draft", title: `${created} טיוטות חשבון ריטיינר נוצרו לחודש ${month.slice(5, 7)}/${month.slice(0, 4)}`, link: "/invoices?status=draft", dedupeKey: `retainer:${month}` });
  }
  return { created };
}
