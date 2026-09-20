import { describe, expect, it } from "vitest";
import { parseCbsResponse } from "@/lib/jobs/cbs-parse";
import live from "../fixtures/cbs-price-response.json";

describe("parseCbsResponse", () => {
  it("reads the live CBS shape: month[].date[].currBase.value (the daily fetch found nothing in it)", () => {
    expect(parseCbsResponse(live)).toEqual([
      { month: "2026-05-01", value: 104.8 },
      { month: "2026-06-01", value: 104.8 },
      { month: "2026-07-01", value: 105.1 },
      { month: "2026-08-01", value: 105.8 },
    ]);
  });

  it("still accepts the older flat shape and ignores rows without a value", () => {
    expect(parseCbsResponse({ data: [{ year: 2025, month: 12, value: "103.2" }, { year: 2026, month: 1 }, { Year: 2026, Month: 2, Value: 103.9 }] })).toEqual([
      { month: "2025-12-01", value: 103.2 },
      { month: "2026-02-01", value: 103.9 },
    ]);
  });

  it("never mistakes the top-level 'month' array or a series code for a month", () => {
    expect(parseCbsResponse({ month: [{ code: 120010, name: "x", date: [] }], year: 2026 })).toEqual([]);
    expect(parseCbsResponse(null)).toEqual([]);
  });
});
