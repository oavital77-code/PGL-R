/**
 * Report cells that hold an enum code must render as Hebrew, on screen and in exports.
 * Before this, a report showed "fixed_price" and "partially_paid" to the user.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { flattenEnums } from "@/lib/reports/enums";
import type { ReportColumn } from "@/lib/reports/types";

const root = path.resolve(__dirname, "../..");
const he = JSON.parse(fs.readFileSync(path.join(root, "messages/he.json"), "utf-8")) as Record<string, unknown>;
const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf-8")) as Record<string, unknown>;

/** Every enumKey a report column declares, read from the query sources. */
function declaredNamespaces(): string[] {
  const dir = path.join(root, "lib/reports/queries");
  const src = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf-8")).join("\n");
  return [...new Set([...src.matchAll(/enumKey: "([^"]+)"/g)].map((m) => m[1]!))];
}

function resolve(catalog: Record<string, unknown>, ns: string): Record<string, unknown> | null {
  let cur: unknown = catalog;
  for (const part of ns.split(".")) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "object" && cur !== null ? (cur as Record<string, unknown>) : null;
}

describe("report enum columns", () => {
  it("declare at least the statuses, methods, kinds and audit actions", () => {
    expect(declaredNamespaces().sort()).toEqual(["audit.actions", "invoices.kinds", "invoices.status", "receipts.methods", "supplier_invoices.status"]);
  });

  it("point at a namespace that exists in both catalogs and holds only strings", () => {
    for (const ns of declaredNamespaces()) {
      for (const [lang, catalog] of [["he", he], ["en", en]] as const) {
        const node = resolve(catalog, ns);
        expect(node, `${ns} missing in ${lang}.json`).not.toBeNull();
        expect(Object.values(node!).every((v) => typeof v === "string"), `${ns} in ${lang}.json has a non-string`).toBe(true);
      }
    }
  });

  it("flattens a namespace to the lookup the exports use", () => {
    const columns = [{ key: "status", label: "status", type: "text", enumKey: "invoices.status" }] as ReportColumn[];
    const flat = flattenEnums(he, columns);
    expect(flat["invoices.status.paid"]).toBe("שולם");
    expect(flat["invoices.status.partially_paid"]).toBe("שולם חלקית");
  });

  it("ignores columns without an enum", () => {
    expect(flattenEnums(he, [{ key: "total", label: "total", type: "money" }] as ReportColumn[])).toEqual({});
  });
});
