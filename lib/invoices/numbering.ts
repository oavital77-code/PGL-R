import "server-only";
import { and, eq, max, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { getSettingFresh, setSetting } from "@/lib/settings/service";

/**
 * Allocate the next invoice number at draft creation (spec §11.2) under an advisory lock.
 * global: {prefix}{seq} ; yearly: {prefix}{year}-{seq}
 */
export async function allocateInvoiceNumber(tx: Tx, userId: string, invoiceDate: string): Promise<{ invoiceNumber: string; sequenceNo: number; sequenceYear: number | null }> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('numbering.invoice'))`);
  const n = await getSettingFresh("numbering", tx);
  const year = Number(invoiceDate.slice(0, 4));
  let seq: number;
  let sequenceYear: number | null = null;
  if (n.invoice.mode === "yearly") {
    if (n.invoice.year !== year) {
      n.invoice.year = year;
      n.invoice.next = 1;
    }
    seq = n.invoice.next;
    sequenceYear = year;
  } else {
    seq = n.invoice.next;
  }
  const format = (s: number) => (n.invoice.mode === "yearly" ? `${n.invoice.prefix}${year}-${s}` : `${n.invoice.prefix}${s}`);
  // never reuse an existing number (e.g. after import)
  while ((await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.invoiceNumber, format(seq))).limit(1)).length > 0) seq++;
  await setSetting("numbering", { ...n, invoice: { ...n.invoice, next: seq + 1, year: n.invoice.mode === "yearly" ? year : n.invoice.year } }, userId, tx);
  return { invoiceNumber: format(seq), sequenceNo: seq, sequenceYear };
}

/** "חשבון חלקי מס' N" – per contract, cancelled invoices are not counted, credits are (spec §11.2). */
export async function nextPartialNumber(tx: Tx, contractId: string): Promise<number> {
  const [r] = await tx
    .select({ n: max(invoices.partialNumber) })
    .from(invoices)
    .where(and(eq(invoices.contractId, contractId), sql`${invoices.status} <> 'cancelled'`));
  return (r?.n ?? 0) + 1;
}
