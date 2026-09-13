import { describe, expect, it } from "vitest";
import { add, applyDiscount, applyPct, dec, isZero, money, pct, pctOf, ratio6, round, sub, sumMoney, sumPct } from "@/lib/calc/money";

describe("money helpers", () => {
  it("rounds half-up to 2 decimals", () => {
    expect(money(1.005)).toBe(1.01);
    expect(money("1.005")).toBe(1.01);
    expect(money(2.675)).toBe(2.68);
    expect(money(-1.005)).toBe(-1.01);
  });
  it("handles null / empty", () => {
    expect(dec(null).toNumber()).toBe(0);
    expect(dec(undefined).toNumber()).toBe(0);
    expect(dec("").toNumber()).toBe(0);
    expect(isZero(null)).toBe(true);
    expect(isZero(1)).toBe(false);
  });
  it("percent & ratio scales", () => {
    expect(pct(12.34567)).toBe(12.346);
    expect(ratio6(1.0304567)).toBe(1.030457);
    expect(round(1.23456, 3)).toBe(1.235);
  });
  it("arithmetic", () => {
    expect(add(0.1, 0.2)).toBe(0.3);
    expect(sub(1, 0.9)).toBe(0.1);
    expect(applyPct(84_000, 10)).toBe(8_400);
    expect(applyDiscount(8_400, 10)).toBe(7_560);
    expect(applyDiscount(100, null)).toBe(100);
    expect(sumMoney([1, "2", null, undefined, 3.005])).toBe(6.01);
    expect(sumPct([10, 15, 25, 15, 10, 15, 10])).toBe(100);
    expect(pctOf(7_560, 189_000)).toBe(4);
    expect(pctOf(1, 0)).toBeNull();
  });
});
