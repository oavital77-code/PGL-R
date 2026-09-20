import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import he from "@/messages/he.json";
import en from "@/messages/en.json";
import { reportTitle } from "@/lib/reports/labels";

/**
 * Every report in the registry must have a name in both languages, and it must be stored the
 * way next-intl reads it: nested, never one flat key with a dot inside. A flat "hours.by_project"
 * key is looked up as the path names → hours → by_project, misses, and the screen falls back to
 * the raw key (the report list showed "monthly_by_employee" until 20/09/2026).
 */
const KEYS = [...readFileSync("lib/reports/registry.ts", "utf8").matchAll(/\{\s*key:\s*"([^"]+)"/g)].map((m) => m[1]!);

const names = (m: typeof he) => m.reports.names as unknown as Record<string, Record<string, string>>;

describe("report names", () => {
  it("reads every key out of the registry", () => {
    expect(KEYS.length).toBe(24);
    expect(KEYS).toContain("hours.monthly_by_employee");
  });

  it.each(["he", "en"])("has a name for every report in %s", (locale) => {
    const messages = names(locale === "he" ? he : (en as unknown as typeof he));
    const missing = KEYS.filter((k) => reportTitle(messages, k) === k);
    expect(missing).toEqual([]);
  });

  it("stores no name under a key that holds a dot", () => {
    for (const m of [he, en as unknown as typeof he]) {
      expect(Object.keys(names(m)).filter((k) => k.includes("."))).toEqual([]);
      for (const group of Object.values(names(m))) expect(Object.keys(group).filter((k) => k.includes("."))).toEqual([]);
    }
  });

  it("falls back to the key when nothing matches", () => {
    expect(reportTitle({ hours: { by_project: "שעות לפי פרויקט" } }, "hours.by_project")).toBe("שעות לפי פרויקט");
    expect(reportTitle({}, "nope.at_all")).toBe("nope.at_all");
  });
});
