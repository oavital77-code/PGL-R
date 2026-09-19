import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, contacts, contracts, documents, invoiceLines, invoices, projects, subContracts, timeEntries, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { downloadBytes } from "@/lib/storage";
import { formatDate, formatHours, formatMoney, formatMonth, formatPct } from "@/lib/i18n/format";
import { fontDataUri, htmlToPdf } from "./render";
import he from "@/messages/he.json";

const T: Record<string, string> = new Proxy(he.pdf as Record<string, string>, { get: (o, k: string) => o[k] ?? k });
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const m = (v: unknown) => formatMoney(v as number, { symbol: false });

export interface SignerInfo {
  id: string;
  name: string;
  title: string;
  /** null = manual signature mode: name and title over a blank line, signed by hand */
  signaturePath: string | null;
}

/** Load everything for the invoice PDF and render HTML per spec §11.8. */
export async function buildInvoiceHtml(invoiceId: string, opts: { draft: boolean; signer?: SignerInfo }): Promise<string> {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) throw new Error("invoice not found");
  const [ctx] = await db
    .select({ workNumber: projects.workNumber, projectName: projects.name, clientName: clients.name, clientTaxId: clients.taxId, clientId: clients.id })
    .from(contracts)
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .where(eq(contracts.id, inv.contractId));
  const [paying] = inv.payingClientId ? await db.select({ name: clients.name, taxId: clients.taxId, id: clients.id, street: clients.addressStreet, city: clients.addressCity }).from(clients).where(eq(clients.id, inv.payingClientId)) : await db.select({ name: clients.name, taxId: clients.taxId, id: clients.id, street: clients.addressStreet, city: clients.addressCity }).from(clients).where(eq(clients.id, inv.clientId));
  const recipients = await db.select({ first: contacts.firstName, last: contacts.lastName, email: contacts.email }).from(contacts).where(and(eq(contacts.clientId, paying!.id), eq(contacts.receivesInvoices, true), isNull(contacts.deletedAt)));
  const lines = await db.select({ l: invoiceLines, scName: subContracts.name, scDefault: subContracts.isDefault, scNumber: subContracts.numberInContract }).from(invoiceLines).innerJoin(subContracts, eq(subContracts.id, invoiceLines.subContractId)).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(subContracts.numberInContract, invoiceLines.sortOrder);
  const [company, invSettings] = await Promise.all([getSetting("company"), getSetting("invoices")]);
  const [original] = inv.creditOfInvoiceId ? await db.select({ n: invoices.invoiceNumber }).from(invoices).where(eq(invoices.id, inv.creditOfInvoiceId)) : [];

  let logo = "";
  if (company.logo_document_id) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, company.logo_document_id));
    if (doc) logo = `data:${doc.mimeType};base64,${(await downloadBytes(doc.storageBucket, doc.storagePath)).toString("base64")}`;
  }
  let iso = "";
  if (company.iso_badge_document_id) {
    const [doc] = await db.select().from(documents).where(eq(documents.id, company.iso_badge_document_id));
    if (doc) iso = `data:${doc.mimeType};base64,${(await downloadBytes(doc.storageBucket, doc.storagePath)).toString("base64")}`;
  }
  let signature = "";
  if (opts.signer?.signaturePath) {
    try {
      signature = `data:image/png;base64,${(await downloadBytes("signatures", opts.signer.signaturePath)).toString("base64")}`;
    } catch {
      signature = "";
    }
  }

  // group lines per sub-contract
  const groups = new Map<string, { title: string; lines: typeof lines }>();
  for (const row of lines) {
    if (row.l.lineType === "extra" || row.l.lineType === "adjustment") continue;
    const key = row.l.subContractId;
    const g = groups.get(key) ?? { title: row.scDefault ? ctx!.projectName : row.scName, lines: [] };
    g.lines.push(row);
    groups.set(key, g);
  }
  const extras = lines.filter((r) => r.l.lineType === "extra" || r.l.lineType === "adjustment");
  const sign = inv.invoiceKind === "credit" ? -1 : 1;

  const tables = [...groups.values()]
    .map((g) => {
      const kind = g.lines[0]!.l.lineType;
      if (kind === "milestone") {
        const sum = (f: (l: (typeof g.lines)[number]["l"]) => number) => g.lines.reduce((a, r) => a + f(r.l), 0);
        const sumStage = sum((l) => Number(l.stageAmount));
        return `<h3>${esc(g.title)}</h3><table><thead><tr><th>${T.stage}</th><th>${T.stage_pct}</th><th>${T.stage_amount}</th><th>${T.progress_this}</th><th>${T.cumulative_pct}</th><th>${T.amount_this}</th><th>${T.cumulative_amount}</th></tr></thead><tbody>${g.lines
          .map((r) => `<tr><td class="t">${esc(r.l.description)}</td><td>${formatPct(r.l.stagePct, 3)}</td><td>${m(r.l.stageAmount)}</td><td>${formatPct(Number(r.l.progressPctThis) , 3)}</td><td>${formatPct(r.l.cumulativePct, 3)}</td><td>${m(Number(r.l.amountThis) * sign)}</td><td>${m(r.l.cumulativeAmount)}</td></tr>`)
          .join("")}</tbody><tfoot><tr><td class="t">${T.total_row}</td><td>${formatPct(sum((l) => Number(l.stagePct)), 3)}</td><td>${m(sumStage)}</td><td>${sumStage ? formatPct((sum((l) => Number(l.amountThis)) / sumStage) * 100, 3) : "—"}</td><td>${sumStage ? formatPct((sum((l) => Number(l.cumulativeAmount)) / sumStage) * 100, 3) : "—"}</td><td>${m(sum((l) => Number(l.amountThis)) * sign)}</td><td>${m(sum((l) => Number(l.cumulativeAmount)))}</td></tr></tfoot></table>`;
      }
      if (kind === "hours") {
        return `<h3>${esc(g.title)}</h3><table><thead><tr><th>${T.employee_grade}</th><th>${T.hours}</th><th>${T.rate}</th><th>${T.amount}</th></tr></thead><tbody>${g.lines.map((r) => `<tr><td class="t">${esc(r.l.description)}</td><td>${Number(r.l.hours).toFixed(2)}</td><td>${m(r.l.hourlyRate)}</td><td>${m(Number(r.l.amountThis) * sign)}</td></tr>`).join("")}</tbody><tfoot><tr><td class="t">${T.total_row}</td><td>${g.lines.reduce((a, r) => a + Number(r.l.hours), 0).toFixed(2)}</td><td></td><td>${m(g.lines.reduce((a, r) => a + Number(r.l.amountThis), 0) * sign)}</td></tr></tfoot></table>`;
      }
      if (kind === "unit") {
        return `<h3>${esc(g.title)}</h3><table><thead><tr><th>${T.description}</th><th>${T.quantity}</th><th>${T.unit_price}</th><th>${T.cumulative_quantity}</th><th>${T.amount}</th></tr></thead><tbody>${g.lines.map((r) => `<tr><td class="t">${esc(r.l.description)}</td><td>${Number(r.l.quantity).toFixed(3)}</td><td>${m(r.l.unitPrice)}</td><td>${(Number(r.l.cumulativeQuantity) + Number(r.l.quantity)).toFixed(3)}</td><td>${m(Number(r.l.amountThis) * sign)}</td></tr>`).join("")}</tbody></table>`;
      }
      return `<h3>${esc(g.title)}</h3><table><thead><tr><th>${T.description}</th><th>${T.amount}</th></tr></thead><tbody>${g.lines.map((r) => `<tr><td class="t">${esc(r.l.description)}</td><td>${m(Number(r.l.amountThis) * sign)}</td></tr>`).join("")}</tbody></table>`;
    })
    .join("");

  const extrasTable = extras.length
    ? `<h3>${T.extras}</h3><table><thead><tr><th>${T.description}</th><th>${T.amount}</th></tr></thead><tbody>${extras.map((r) => `<tr><td class="t">${esc(r.l.description)}</td><td>${m(Number(r.l.amountThis) * sign)}</td></tr>`).join("")}</tbody></table>`
    : "";

  // hours appendix
  let appendix = "";
  if (invSettings.attach_hours_appendix && lines.some((r) => r.l.lineType === "hours")) {
    const te = await db
      .select({ d: timeEntries.workDate, first: users.firstName, last: users.lastName, desc: timeEntries.description, minutes: timeEntries.minutes })
      .from(timeEntries)
      .innerJoin(users, eq(users.id, timeEntries.userId))
      .where(and(eq(timeEntries.invoiceId, invoiceId), isNull(timeEntries.deletedAt)))
      .orderBy(timeEntries.workDate);
    if (te.length)
      appendix = `<div class="page-break"></div><h2>${T.hours_appendix}</h2><table><thead><tr><th>${T.date}</th><th>${T.employee}</th><th>${T.description}</th><th>${T.hours}</th></tr></thead><tbody>${te.map((e) => `<tr><td>${formatDate(e.d)}</td><td class="t">${esc(e.first)} ${esc(e.last)}</td><td class="t">${esc(e.desc)}</td><td>${formatHours(e.minutes)}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="3" class="t">${T.total_row}</td><td>${formatHours(te.reduce((a, e) => a + e.minutes, 0))}</td></tr></tfoot></table>`;
  }

  const summaryRows: string[] = [];
  const row = (label: string | undefined, value: string, cls = "") => summaryRows.push(`<tr class="${cls}"><td class="t">${label}</td><td>${value}</td></tr>`);
  row(T.cumulative_base, m(inv.cumulativeBase));
  row(T.receipts_base, m(inv.receiptsBase));
  row(T.open_base, m(inv.openBase));
  row(T.subtotal_base, m(inv.subtotalBase), "strong");
  if (inv.indexLinked) {
    row(`${T.index_base} ${formatMonth(inv.indexBaseMonth)} = ${Number(inv.indexBaseValue ?? 0).toFixed(1)} · ${T.index_current} ${formatMonth(inv.indexMonth)} = ${Number(inv.indexCurrentValue ?? 0).toFixed(1)}`, "");
    row(T.index_diff, m(inv.indexDiff));
  }
  if (Number(inv.retentionAmount) !== 0 && invSettings.show_retention) row(`${T.retention} (${formatPct(inv.retentionPct, 2)})`, `-${m(inv.retentionAmount)}`);
  row(T.before_vat, m(inv.beforeVat));
  row(inv.vatExempt ? `${T.vat_exempt}${inv.vatExemptReason ? ` – ${esc(inv.vatExemptReason)}` : ""}` : `${T.vat} ${formatPct(inv.vatRate, 2)}`, m(inv.vatAmount));
  row(T.total_to_pay, m(inv.total), "total");
  if (inv.expectedReceipt && invSettings.show_withholding) row(`${T.withholding} (${formatPct(inv.withholdingPct, 2)})`, m(inv.expectedReceipt));

  const bank = company.bank;
  const font = fontDataUri();
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:"Assistant";src:url("${font}") format("truetype");font-weight:200 800}
@page{size:A4;margin:14mm 12mm 18mm 12mm}
*{box-sizing:border-box}body{font-family:"Assistant",Arial,sans-serif;font-size:11pt;color:#111;margin:0;direction:rtl}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2a3380;padding-bottom:8px;margin-bottom:10px}
.logo img{max-height:60px}.date{font-size:10pt}.title{text-align:center;font-size:18pt;font-weight:700;color:#2a3380;margin:8px 0}
.blocks{display:flex;justify-content:space-between;gap:16px;margin:8px 0;font-size:10.5pt}.block{border:1px solid #ddd;border-radius:4px;padding:6px 10px;min-width:45%}
h2{font-size:14pt;color:#2a3380;margin:12px 0 6px}h3{font-size:11.5pt;margin:12px 0 4px;color:#2a3380}
table{width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:6px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:center;direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}
th{background:#eef0fb;color:#1f2660}td.t,th.t{text-align:right;direction:rtl}tfoot td{font-weight:700;background:#f6f7fb}
.summary{width:60%;margin-inline-start:auto;margin-top:12px}.summary td{text-align:left}.summary td.t{text-align:right}.summary tr.strong td{font-weight:700}.summary tr.total td{font-weight:800;background:#eef0fb;font-size:11.5pt}
.sig{margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end}.sig img{max-height:70px}.sig .name{font-weight:700}.sig .sigline{width:200px;height:48px;border-bottom:1px solid #000;color:#666;font-size:10px;display:flex;align-items:flex-end}
.footer{position:fixed;bottom:-12mm;left:0;right:0;font-size:8.5pt;color:#555;border-top:1px solid #ccc;padding-top:4px;display:flex;justify-content:space-between;align-items:center}
.watermark{position:fixed;top:40%;left:10%;right:10%;text-align:center;font-size:48pt;color:rgba(220,38,38,.18);transform:rotate(-20deg);font-weight:800;pointer-events:none}
.page-break{page-break-before:always}.intro{margin:6px 0 10px}.bank{font-size:9.5pt;margin-top:10px;color:#333}
</style></head><body>
${opts.draft ? `<div class="watermark">${T.draft_watermark}</div>` : ""}
<div class="header"><div class="logo">${logo ? `<img src="${logo}" alt="logo">` : `<strong style="font-size:16pt;color:#2a3380">${esc(company.name)}</strong>`}</div><div class="date">${T.date}: ${formatDate(inv.invoiceDate)}</div></div>
<div class="title">${inv.invoiceKind === "credit" ? T.credit_title : T.title} ${esc(inv.invoiceNumber)}</div>
<div class="blocks">
 <div class="block"><div><strong>${T.to}:</strong> ${esc(paying?.name)}</div>${paying?.taxId ? `<div>${T.client_tax_id}: <span dir="ltr">${esc(paying.taxId)}</span></div>` : ""}${paying?.street || paying?.city ? `<div>${esc([paying?.street, paying?.city].filter(Boolean).join(", "))}</div>` : ""}${recipients.map((r) => `<div>${esc(r.first)} ${esc(r.last)}${r.email ? ` · <span dir="ltr">${esc(r.email)}</span>` : ""}</div>`).join("")}</div>
 <div class="block"><div><strong>${T.work_number}:</strong> <span dir="ltr">${esc(ctx?.workNumber)}</span></div><div><strong>${T.company_tax_id}:</strong> <span dir="ltr">${esc(company.tax_id)}</span></div><div><strong>${T.partial}:</strong> ${inv.partialNumber}</div>${inv.periodFrom ? `<div><strong>${T.period}:</strong> ${formatDate(inv.periodFrom)} – ${formatDate(inv.periodTo)}</div>` : ""}</div>
</div>
<div><strong>${T.subject}:</strong> ${esc(inv.subject ?? ctx?.projectName)}</div>
<div><strong>${inv.invoiceKind === "credit" ? `${T.credit_of} ${esc(original?.n ?? "")}` : `${T.partial_invoice} ${inv.partialNumber}`}</strong></div>
${inv.introText ? `<p class="intro">${esc(inv.introText)}</p>` : ""}
<h2>${esc(ctx?.projectName)}</h2>
${tables}${extrasTable}
<table class="summary">${summaryRows.join("")}</table>
<div class="bank">${T.payment_terms}: ${formatDate(inv.dueDate)}${bank.bank ? ` · ${T.bank_details}: ${esc(bank.bank)} ${T.branch} ${esc(bank.branch)} ${T.account} <span dir="ltr">${esc(bank.account)}</span> ${bank.beneficiary ? `(${esc(bank.beneficiary)})` : ""}` : ""}</div>
${inv.notes ? `<p class="intro">${esc(inv.notes)}</p>` : ""}
${opts.signer ? `<div class="sig"><div><div class="name">${esc(opts.signer.name)}${opts.signer.title ? `, ${esc(opts.signer.title)}` : ""}</div><div>${formatDate(new Date())}</div></div>${signature ? `<img src="${signature}" alt="signature">` : `<div class="sigline">${T.signature}</div>`}</div>` : ""}
${appendix}
<div class="footer"><div>${esc(company.name)} · ${esc(company.address)} · ${T.phone} <span dir="ltr">${esc(company.phone)}</span>${company.fax ? ` · ${T.fax} <span dir="ltr">${esc(company.fax)}</span>` : ""} · <span dir="ltr">${esc(company.website)}</span> · <span dir="ltr">${esc(company.email)}</span>${company.pdf_footer_text ? ` · ${esc(company.pdf_footer_text)}` : ""}</div>${iso ? `<img src="${iso}" style="max-height:28px" alt="ISO">` : ""}</div>
</body></html>`;
}

export async function renderInvoicePdf(invoiceId: string, opts: { draft: boolean; signer?: SignerInfo }): Promise<Buffer> {
  const html = await buildInvoiceHtml(invoiceId, opts);
  return htmlToPdf(html);
}

