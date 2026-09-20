import { describe, expect, it } from "vitest";
import {
  computeIndexRatio,
  findIndexValue,
  indexDifference,
  lastPublishedIndexMonth,
  previousMonth,
  resolveInvoiceIndexMonth,
  toMonthKey,
} from "@/lib/calc/index-linkage";

const values = [
  { month: "2026-05-01", value: 100 },
  { month: "2026-06-01", value: 101 },
  { month: "2026-07-01", value: 103 },
];

describe("index linkage", () => {
  it("month helpers", () => {
    expect(toMonthKey("2026-09-13")).toBe("2026-09-01");
    expect(previousMonth("2026-01-01")).toBe("2025-12-01");
    expect(previousMonth("2026-09-01")).toBe("2026-08-01");
    expect(findIndexValue(values, "2026-06-01")).toBe(101);
    expect(findIndexValue(values, "2026-08-01")).toBeNull();
  });
  it("resolves invoice month by rule", () => {
    expect(resolveInvoiceIndexMonth(values, "2026-09-13", "latest_known")).toBe("2026-07-01");
    expect(resolveInvoiceIndexMonth(values, "2026-09-13", "previous_month")).toBe("2026-08-01");
    expect(resolveInvoiceIndexMonth(values, "2026-06-15", "latest_known")).toBe("2026-06-01");
    expect(resolveInvoiceIndexMonth(values, "2026-04-15", "latest_known")).toBeNull();
    expect(resolveInvoiceIndexMonth(values, "2026-09-13", "latest_known", "2026-05-01")).toBe("2026-05-01");
  });
  it("ratio 1.03 (linked)", () => {
    expect(computeIndexRatio({ indexLinked: true, indexFloor: false, baseValue: 100, currentValue: 103 })).toEqual({ ratio: 1.03, missingValue: false, floored: false });
    expect(indexDifference(7_560, 1.03)).toBe(226.8);
  });
  it("floor: ratio 0.98 → 1", () => {
    expect(computeIndexRatio({ indexLinked: true, indexFloor: true, baseValue: 100, currentValue: 98 })).toEqual({ ratio: 1, missingValue: false, floored: true });
    expect(computeIndexRatio({ indexLinked: true, indexFloor: false, baseValue: 100, currentValue: 98 })).toEqual({ ratio: 0.98, missingValue: false, floored: false });
    expect(indexDifference(7_560, 0.98)).toBe(-151.2);
  });
  it("not linked → 1; missing value flagged", () => {
    expect(computeIndexRatio({ indexLinked: false, indexFloor: true, baseValue: 100, currentValue: 50 })).toEqual({ ratio: 1, missingValue: false, floored: false });
    expect(computeIndexRatio({ indexLinked: true, indexFloor: false, baseValue: 100, currentValue: null })).toEqual({ ratio: 1, missingValue: true, floored: false });
    expect(computeIndexRatio({ indexLinked: true, indexFloor: false, baseValue: 0, currentValue: 100 }).missingValue).toBe(true);
  });
  it("6 decimal ratio", () => {
    expect(computeIndexRatio({ indexLinked: true, indexFloor: false, baseValue: 103.7, currentValue: 106.2 }).ratio).toBe(1.024108);
  });
  it("anchors a new contract to the last index published on the signing day", () => {
    // month M is published on the 15th of M+1
    expect(lastPublishedIndexMonth("2026-09-19")).toBe("2026-08-01");
    expect(lastPublishedIndexMonth("2026-09-15")).toBe("2026-08-01");
    expect(lastPublishedIndexMonth("2026-09-14")).toBe("2026-07-01");
    expect(lastPublishedIndexMonth("2026-01-03")).toBe("2025-11-01");
  });
});
