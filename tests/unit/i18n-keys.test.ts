/**
 * Guards spec §0 principle 1: every UI string comes from a message key, in both catalogs.
 * A missing key used to crash the whole screen; it now degrades one label (lib/i18n/errors.ts),
 * which is exactly why it needs a test to stay visible.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const he = JSON.parse(fs.readFileSync(path.join(root, "messages/he.json"), "utf-8")) as Record<string, unknown>;
const en = JSON.parse(fs.readFileSync(path.join(root, "messages/en.json"), "utf-8")) as Record<string, unknown>;

function leafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" && v !== null ? leafKeys(v as Record<string, unknown>, full) : [full];
  });
}

function hasMessage(catalog: Record<string, unknown>, keyPath: string): boolean {
  let cur: unknown = catalog;
  for (const part of keyPath.split(".")) {
    if (typeof cur !== "object" || cur === null || !(part in (cur as Record<string, unknown>))) return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string";
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const ASSIGN = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:getTranslations|useTranslations)\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g;
const CALL = /\b(\w+)\(\s*"([A-Za-z0-9_.]+)"/g;

/** Literal keys used in code, resolved against the namespace in scope at the call site. */
function usedKeys(): { file: string; line: number; key: string }[] {
  const out: { file: string; line: number; key: string }[] = [];
  for (const dir of ["app", "components", "lib"]) {
    for (const file of sourceFiles(path.join(root, dir))) {
      const src = fs.readFileSync(file, "utf-8");
      const assigns = [...src.matchAll(ASSIGN)].map((m) => ({ at: m.index ?? 0, name: m[1]!, ns: m[2] ?? m[3] ?? "" }));
      if (assigns.length === 0) continue;
      const names = new Set(assigns.map((a) => a.name));
      for (const m of src.matchAll(CALL)) {
        const [, name, key] = m;
        if (!names.has(name!)) continue;
        // `t.has("x")` is a deliberate existence check, not a lookup that can fail
        if (src.slice(Math.max(0, (m.index ?? 0) - 4), m.index).endsWith(".has")) continue;
        const scope = assigns.filter((a) => a.at < (m.index ?? 0) && a.name === name).pop();
        if (!scope) continue;
        out.push({
          file: path.relative(root, file),
          line: src.slice(0, m.index).split("\n").length,
          key: scope.ns ? `${scope.ns}.${key}` : key!,
        });
      }
    }
  }
  return out;
}

describe("message catalogs", () => {
  it("define every key the code looks up, in Hebrew", () => {
    const missing = usedKeys().filter((u) => !hasMessage(he, u.key));
    expect(missing.map((m) => `${m.file}:${m.line} → ${m.key}`)).toEqual([]);
  });

  it("define every key the code looks up, in English", () => {
    const missing = usedKeys().filter((u) => !hasMessage(en, u.key));
    expect(missing.map((m) => `${m.file}:${m.line} → ${m.key}`)).toEqual([]);
  });

  it("hold the same keys in both languages", () => {
    const hk = new Set(leafKeys(he));
    const ek = new Set(leafKeys(en));
    expect([...hk].filter((k) => !ek.has(k))).toEqual([]);
    expect([...ek].filter((k) => !hk.has(k))).toEqual([]);
  });
});
