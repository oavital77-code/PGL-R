/** Stage 6: template → parse → validate → execute → rollback round trip (spec §15). */
import "dotenv/config";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { getEntity } from "@/lib/import/spec";
import { buildTemplate } from "@/lib/import/templates";
import { parseWorkbook } from "@/lib/import/parse";
import { executeRows, rollbackCreated, validateRows } from "@/lib/import/engine";

async function fill(entityKey: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  const entity = getEntity(entityKey)!;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(new Uint8Array(await buildTemplate(entity)) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0]!;
  ws.spliceRows(2, 2); // drop description + example rows
  for (const r of rows) ws.addRow(entity.columns.map((c) => r[c.key] ?? ""));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe.skipIf(!process.env.DATABASE_URL)("import engine", () => {
  const stamp = Date.now();
  const clientName = `לקוח ייבוא ${stamp}`;
  const wn = `IMP-${stamp}`;
  let adminId = "";

  it("validates and rejects bad rows", async () => {
    const [admin] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "admin")).limit(1);
    adminId = admin!.id;
    const bytes = await fill("clients", [{ name: clientName, tax_id: "512066176", client_kind: "authority", payment_terms_days: 45, vat_exempt: "לא" }, { name: "", email: "not-an-email" }]);
    const parsed = await parseWorkbook(getEntity("clients")!, bytes);
    expect(parsed.rows).toHaveLength(2);
    const v = await validateRows("clients", parsed.rows);
    expect(v.ok).toBe(false);
    expect(v.rows[1]!.errors.join(",")).toMatch(/required/);
    expect(v.rows[1]!.errors.join(",")).toMatch(/invalid_email/);
  });

  it("executes clients → projects → contracts → sub_contracts → milestones and rolls back", async () => {
    const created: Record<string, string[]>[] = [];
    const run = async (key: string, rows: Record<string, unknown>[]) => {
      const bytes = await fill(key, rows);
      const parsed = await parseWorkbook(getEntity(key)!, bytes);
      const v = await validateRows(key, parsed.rows);
      expect(v.rows.flatMap((r) => r.errors), key).toEqual([]);
      const c = await executeRows(key, v.rows, adminId);
      created.push(c);
      return v;
    };
    await run("clients", [{ name: clientName, client_kind: "company" }]);
    await run("projects", [{ work_number: wn, name: "פרויקט ייבוא", client_name: clientName, status_code: "active" }]);
    await run("contracts", [{ work_number: wn, direction: "income", contract_number: 1, name: "חוזה ייבוא", signed_date: "01/02/2026", index_linked: "כן", index_base_month: "01/2026" }]);
    const v = await run("sub_contracts", [{ work_number: wn, direction: "income", contract_number: 1, sub_contract_number: 1, name: "תב\"ע", pricing_method: "fixed_price", base_price: 84000, discount_pct: 10, admiral_submitted: 7560, admiral_paid: 0, admiral_remaining: 68040 }]);
    expect(v.expected?.[`${wn}|1|1`]?.remaining).toBe(68040);
    await run("milestones", [
      { work_number: wn, direction: "income", contract_number: 1, sub_contract_number: 1, sort_order: 1, stage_name: "לימוד מצב קיים", pct: 10, opening_billed_pct: 100, opening_paid_amount: 0 },
      { work_number: wn, direction: "income", contract_number: 1, sub_contract_number: 1, sort_order: 2, stage_name: "הכנת חלופות", pct: 90 },
    ]);
    const [p] = await db.select({ id: s.projects.id, statusId: s.projects.statusId }).from(s.projects).where(eq(s.projects.workNumber, wn));
    expect(p).toBeTruthy();
    const ms = await db.select().from(s.milestones).innerJoin(s.subContracts, eq(s.subContracts.id, s.milestones.subContractId)).innerJoin(s.contracts, eq(s.contracts.id, s.subContracts.contractId)).where(eq(s.contracts.projectId, p!.id));
    expect(ms).toHaveLength(2);
    // opening balance: 100% of 7,560 submitted
    const { contractBalancesReport } = await import("@/lib/reports/balances");
    const rep = await contractBalancesReport({ projectIds: [p!.id] });
    expect(rep.projects[0]!.balances.submitted).toBe(7_560);
    expect(rep.projects[0]!.balances.remaining).toBe(68_040);
    // duplicate import is rejected
    const dup = await validateRows("projects", (await parseWorkbook(getEntity("projects")!, await fill("projects", [{ work_number: wn, name: "x", client_name: clientName }]))).rows);
    expect(dup.rows[0]!.errors).toContain("work_number_exists");
    // rollback in reverse order
    for (const c of created.reverse()) await rollbackCreated(c, adminId);
    const after = await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.workNumber, wn));
    expect(after).toHaveLength(0);
  });
});
