import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { outer } from "@/lib/db/sql";
import { db } from "@/lib/db";
import { invoices, receipts, supplierInvoices, timeEntries, users } from "@/lib/db/schema";
import { todayLocal } from "@/lib/i18n/format";
import { getSetting } from "@/lib/settings/service";
import { contractBalancesReport } from "@/lib/reports/balances";
import { agingBucket, daysBetween } from "@/lib/calc/invoice";

export async function adminKpis() {
  const today = todayLocal();
  const monthStart = `${today.slice(0, 7)}-01`;
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const hoursSettings = await getSetting("hours");
  const invSettings = await getSetting("invoices");

  const openStatuses = ["sent", "partially_paid", "signed", "approved"] as const;
  const openInv = await db
    .select({ id: invoices.id, total: invoices.total, dueDate: invoices.dueDate, status: invoices.status, paid: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = ${outer(invoices.id)} and a.cancelled_at is null),0)` })
    .from(invoices)
    .where(and(isNull(invoices.deletedAt), inArray(invoices.status, [...openStatuses])));
  let openSum = 0;
  let overdueSum = 0;
  let overdueCount = 0;
  const aging = new Map<string, number>();
  for (const i of openInv) {
    const rem = Number(i.total) - Number(i.paid);
    openSum += rem;
    const days = i.dueDate ? daysBetween(i.dueDate, today) : 0;
    if (days > 0) {
      overdueSum += rem;
      overdueCount++;
    }
    const b = agingBucket(days, invSettings.aging_thresholds);
    aging.set(b, (aging.get(b) ?? 0) + rem);
  }

  const [submittedMonth] = await db.select({ s: sql<string>`coalesce(sum(${invoices.subtotalBase}),0)` }).from(invoices).where(and(isNull(invoices.deletedAt), inArray(invoices.status, ["approved", "signed", "sent", "partially_paid", "paid"]), gte(invoices.invoiceDate, monthStart)));
  const [submittedYear] = await db.select({ s: sql<string>`coalesce(sum(${invoices.subtotalBase}),0)` }).from(invoices).where(and(isNull(invoices.deletedAt), inArray(invoices.status, ["approved", "signed", "sent", "partially_paid", "paid"]), gte(invoices.invoiceDate, yearStart)));
  const [receiptsMonth] = await db.select({ s: sql<string>`coalesce(sum(${receipts.amount}),0)` }).from(receipts).where(and(isNull(receipts.deletedAt), gte(receipts.receiptDate, monthStart)));
  const [hoursMonth] = await db.select({ m: sql<string>`coalesce(sum(${timeEntries.minutes}),0)`, u: sql<string>`count(distinct ${timeEntries.userId})` }).from(timeEntries).where(and(isNull(timeEntries.deletedAt), gte(timeEntries.workDate, monthStart), lte(timeEntries.workDate, today)));
  const lastReports = await db.select({ userId: timeEntries.userId, last: sql<string>`max(${timeEntries.workDate})` }).from(timeEntries).where(isNull(timeEntries.deletedAt)).groupBy(timeEntries.userId);
  const activeUsers = await db.select({ id: users.id }).from(users).where(and(eq(users.isActive, true), isNull(users.deletedAt)));
  const lastMap = new Map(lastReports.map((l) => [l.userId, l.last]));
  const behind = activeUsers.filter((u) => {
    const l = lastMap.get(u.id);
    return !l || daysBetween(l, today) > hoursSettings.reminder_days;
  }).length;
  const [pendingSupplier] = await db.select({ c: sql<string>`count(*)` }).from(supplierInvoices).where(and(isNull(supplierInvoices.deletedAt), inArray(supplierInvoices.status, ["pending", "partially_approved"])));
  const pendingActions = await db
    .select({ id: invoices.id, number: invoices.invoiceNumber, status: invoices.status, total: invoices.total })
    .from(invoices)
    .where(and(isNull(invoices.deletedAt), inArray(invoices.status, ["draft", "pending_approval", "approved", "signed"])))
    .orderBy(invoices.createdAt)
    .limit(10);
  const retainerDrafts = pendingActions.filter((p) => p.status === "draft").length;

  // 12-month submitted vs receipts
  const months: { month: string; submitted: number; receipts: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1));
    months.push({ month: d.toISOString().slice(0, 7), submitted: 0, receipts: 0 });
  }
  const firstMonth = `${months[0]!.month}-01`;
  const subRows = await db.select({ m: sql<string>`to_char(${invoices.invoiceDate}, 'YYYY-MM')`, s: sql<string>`sum(${invoices.subtotalBase})` }).from(invoices).where(and(isNull(invoices.deletedAt), inArray(invoices.status, ["approved", "signed", "sent", "partially_paid", "paid"]), gte(invoices.invoiceDate, firstMonth))).groupBy(sql`1`);
  const recRows = await db.select({ m: sql<string>`to_char(${receipts.receiptDate}, 'YYYY-MM')`, s: sql<string>`sum(${receipts.amount})` }).from(receipts).where(and(isNull(receipts.deletedAt), gte(receipts.receiptDate, firstMonth))).groupBy(sql`1`);
  for (const r of subRows) {
    const m = months.find((x) => x.month === r.m);
    if (m) m.submitted = Number(r.s);
  }
  for (const r of recRows) {
    const m = months.find((x) => x.month === r.m);
    if (m) m.receipts = Number(r.s);
  }

  const balances = await contractBalancesReport({ activeOnly: true });
  const remainingTotal = balances.projects.reduce((a, p) => a + (p.balances.remaining ?? 0), 0);
  const topRemaining = [...balances.projects]
    .filter((p) => (p.balances.remaining ?? 0) > 0)
    .sort((a, b) => (b.balances.remaining ?? 0) - (a.balances.remaining ?? 0))
    .slice(0, 10)
    .map((p) => ({ name: `${p.workNumber} – ${p.name}`, remaining: p.balances.remaining ?? 0 }));

  const hoursByDept = await db
    .select({ name: sql<string>`coalesce(d.name, '—')`, minutes: sql<string>`sum(${timeEntries.minutes})` })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .leftJoin(sql`departments d`, sql`d.id = ${users.departmentId}`)
    .where(and(isNull(timeEntries.deletedAt), gte(timeEntries.workDate, monthStart), lt(timeEntries.workDate, sql`(${monthStart}::date + interval '1 month')::date`)))
    .groupBy(sql`d.name`);

  return {
    remainingTotal,
    openSum,
    openCount: openInv.length,
    overdueSum,
    overdueCount,
    submittedMonth: Number(submittedMonth?.s ?? 0),
    submittedYear: Number(submittedYear?.s ?? 0),
    receiptsMonth: Number(receiptsMonth?.s ?? 0),
    hoursMonthMinutes: Number(hoursMonth?.m ?? 0),
    hoursMonthUsers: Number(hoursMonth?.u ?? 0),
    behind,
    pendingSupplier: Number(pendingSupplier?.c ?? 0),
    retainerDrafts,
    pendingActions,
    months,
    topRemaining,
    aging: [...aging.entries()].map(([bucket, amount]) => ({ bucket, amount })),
    hoursByDept: hoursByDept.map((r) => ({ name: r.name, hours: Math.round((Number(r.minutes) / 60) * 100) / 100 })),
  };
}
