import "server-only";
import ExcelJS from "exceljs";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, contracts, invoiceLines, invoices, projects, receiptAllocations, receipts, subContracts } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { getSetting } from "@/lib/settings/service";
import { ACCOUNTING_EXPORT_FIELDS, ACCOUNTING_RECEIPT_FIELDS } from "./fields";

export interface ExportBatch {
  id: string;
  rows: Record<string, unknown>[];
  lines: Record<string, unknown>[];
}

/** Adapter interface (spec §11.14 #3) – only FileAdapter is implemented. */
export interface AccountingAdapter {
  exportInvoices(batch: ExportBatch, format: "xlsx" | "csv"): Promise<{ bytes: Buffer; mime: string; fileName: string }>;
  exportReceipts(batch: ExportBatch, format: "xlsx" | "csv"): Promise<{ bytes: Buffer; mime: string; fileName: string }>;
}

async function toFile(name: string, sheets: { name: string; rows: Record<string, unknown>[]; columns: string[] }[], format: "xlsx" | "csv", mapping: Record<string, string>) {
  const map = (c: string) => mapping[c] ?? c;
  if (format === "csv") {
    const s = sheets[0]!;
    const csv = [s.columns.map(map).join(","), ...s.rows.map((r) => s.columns.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
    return { bytes: Buffer.from("﻿" + csv, "utf8"), mime: "text/csv; charset=utf-8", fileName: `${name}.csv` };
  }
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    ws.columns = s.columns.map((c) => ({ header: map(c), key: c, width: 18 }));
    for (const r of s.rows) ws.addRow(r);
    ws.getRow(1).font = { bold: true };
  }
  return { bytes: Buffer.from(await wb.xlsx.writeBuffer()), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName: `${name}.xlsx` };
}

export const FileAdapter: AccountingAdapter = {
  async exportInvoices(batch, format) {
    const { field_mapping } = await getSetting("accounting");
    return toFile(`invoices-${batch.id.slice(0, 8)}`, [{ name: "invoices", rows: batch.rows, columns: [...ACCOUNTING_EXPORT_FIELDS] }, { name: "lines", rows: batch.lines, columns: ["invoice_number", "sub_contract", "description", "amount"] }], format, field_mapping);
  },
  async exportReceipts(batch, format) {
    const { field_mapping } = await getSetting("accounting");
    return toFile(`receipts-${batch.id.slice(0, 8)}`, [{ name: "receipts", rows: batch.rows, columns: [...ACCOUNTING_RECEIPT_FIELDS] }], format, field_mapping);
  },
};

/** Build + mark an invoice export batch (spec §11.14 #1). */
export async function exportInvoicesBatch(opts: { from?: string; to?: string; onlyNew: boolean; userId: string; format: "xlsx" | "csv" }) {
  const rows = await db
    .select({ i: invoices, clientName: clients.name, clientTaxId: clients.taxId, workNumber: projects.workNumber, projectName: projects.name, creditOf: sql<string | null>`(select o.invoice_number from invoices o where o.id = "invoices"."credit_of_invoice_id")` })
    .from(invoices)
    .innerJoin(contracts, eq(contracts.id, invoices.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(clients, eq(clients.id, sql`coalesce(${invoices.payingClientId}, ${invoices.clientId})`))
    .where(
      and(
        isNull(invoices.deletedAt),
        inArray(invoices.status, ["approved", "signed", "sent", "partially_paid", "paid", "cancelled"]),
        opts.onlyNew ? isNull(invoices.accountingExportedAt) : undefined,
        opts.from ? sql`${invoices.invoiceDate} >= ${opts.from}` : undefined,
        opts.to ? sql`${invoices.invoiceDate} <= ${opts.to}` : undefined,
      ),
    )
    .orderBy(invoices.invoiceDate, invoices.sequenceNo);
  const batchId = crypto.randomUUID();
  const ids = rows.map((r) => r.i.id);
  const lines = ids.length
    ? await db.select({ invoiceId: invoiceLines.invoiceId, sub: subContracts.name, description: invoiceLines.description, amount: invoiceLines.amountThis }).from(invoiceLines).innerJoin(subContracts, eq(subContracts.id, invoiceLines.subContractId)).where(inArray(invoiceLines.invoiceId, ids))
    : [];
  const numberOf = new Map(rows.map((r) => [r.i.id, r.i.invoiceNumber]));
  const batch: ExportBatch = {
    id: batchId,
    rows: rows.map((r) => ({
      invoice_number: r.i.invoiceNumber,
      invoice_date: r.i.invoiceDate,
      due_date: r.i.dueDate,
      client_name: r.clientName,
      client_tax_id: r.clientTaxId,
      work_number: r.workNumber,
      project_name: r.projectName,
      subject: r.i.subject,
      before_vat: Number(r.i.beforeVat),
      vat_rate: Number(r.i.vatRate),
      vat_amount: Number(r.i.vatAmount),
      total: Number(r.i.total),
      index_diff: Number(r.i.indexDiff),
      retention_amount: Number(r.i.retentionAmount),
      status: r.i.status,
      kind: r.i.invoiceKind,
      credit_of: r.creditOf,
    })),
    lines: lines.map((l) => ({ invoice_number: numberOf.get(l.invoiceId), sub_contract: l.sub, description: l.description, amount: Number(l.amount) })),
  };
  if (ids.length) await withUser({ userId: opts.userId }, (tx) => tx.update(invoices).set({ accountingExportedAt: new Date(), accountingExportBatchId: batchId }).where(inArray(invoices.id, ids)));
  return { file: await FileAdapter.exportInvoices(batch, opts.format), count: ids.length };
}

export async function exportReceiptsBatch(opts: { from?: string; to?: string; onlyNew: boolean; userId: string; format: "xlsx" | "csv" }) {
  const rows = await db
    .select({ r: receipts, clientName: clients.name, clientTaxId: clients.taxId })
    .from(receipts)
    .innerJoin(clients, eq(clients.id, receipts.clientId))
    .where(and(isNull(receipts.deletedAt), opts.onlyNew ? isNull(receipts.accountingExportedAt) : undefined, opts.from ? sql`${receipts.receiptDate} >= ${opts.from}` : undefined, opts.to ? sql`${receipts.receiptDate} <= ${opts.to}` : undefined))
    .orderBy(receipts.receiptDate);
  const ids = rows.map((r) => r.r.id);
  const allocs = ids.length ? await db.select({ receiptId: receiptAllocations.receiptId, number: invoices.invoiceNumber, amount: receiptAllocations.amount }).from(receiptAllocations).innerJoin(invoices, eq(invoices.id, receiptAllocations.invoiceId)).where(and(inArray(receiptAllocations.receiptId, ids), isNull(receiptAllocations.cancelledAt))) : [];
  const batchId = crypto.randomUUID();
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const as = allocs.filter((a) => a.receiptId === r.r.id);
    const base = { receipt_date: r.r.receiptDate, client_name: r.clientName, client_tax_id: r.clientTaxId, amount: Number(r.r.amount), method: r.r.method, reference: r.r.reference };
    if (as.length === 0) out.push({ ...base, invoice_number: null, allocated_amount: 0 });
    for (const a of as) out.push({ ...base, invoice_number: a.number, allocated_amount: Number(a.amount) });
  }
  if (ids.length) await withUser({ userId: opts.userId }, (tx) => tx.update(receipts).set({ accountingExportedAt: new Date(), accountingExportBatchId: batchId }).where(inArray(receipts.id, ids)));
  return { file: await FileAdapter.exportReceipts({ id: batchId, rows: out, lines: [] }, opts.format), count: ids.length };
}
