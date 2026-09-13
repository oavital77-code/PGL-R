/**
 * Money / percentage helpers for the pure calculation engine.
 * All monetary amounts are ILS, numeric(12,2), rounded half-up to 2 decimals.
 * Percentages are numeric(6,3). Ratios (index) are 6 decimals.
 *
 * Decimal.js is used internally to avoid binary floating point drift; every
 * exported function returns plain JS numbers already rounded to the required scale.
 */
import Decimal from "decimal.js";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Numeric = number | string | Decimal;

export function dec(v: Numeric | null | undefined): Decimal {
  if (v === null || v === undefined || v === "") return new D(0);
  return new D(v);
}

/** Round half-up to `scale` decimals and return a number. */
export function round(v: Numeric, scale = 2): number {
  return dec(v).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP).toNumber();
}

/** Money: 2 decimals, half-up. */
export const money = (v: Numeric): number => round(v, 2);
/** Percent: 3 decimals, half-up. */
export const pct = (v: Numeric): number => round(v, 3);
/** Ratio: 6 decimals, half-up. */
export const ratio6 = (v: Numeric): number => round(v, 6);

export function add(...vals: Numeric[]): number {
  return money(vals.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new D(0)));
}

export function sub(a: Numeric, b: Numeric): number {
  return money(dec(a).minus(dec(b)));
}

/** base × pct / 100, rounded to money. */
export function applyPct(base: Numeric, percent: Numeric): number {
  return money(dec(base).times(dec(percent)).div(100));
}

/** base × (1 − discountPct/100), rounded to money. */
export function applyDiscount(base: Numeric, discountPct: Numeric | null | undefined): number {
  return money(dec(base).times(new D(1).minus(dec(discountPct).div(100))));
}

/** Sum of numbers, rounded to money. */
export function sumMoney(vals: Iterable<Numeric | null | undefined>): number {
  let acc = new D(0);
  for (const v of vals) acc = acc.plus(dec(v));
  return money(acc);
}

/** Sum of percentages, rounded to 3 decimals. */
export function sumPct(vals: Iterable<Numeric | null | undefined>): number {
  let acc = new D(0);
  for (const v of vals) acc = acc.plus(dec(v));
  return pct(acc);
}

/** a / b × 100 as percent (3 decimals); null when b is 0. */
export function pctOf(a: Numeric, b: Numeric): number | null {
  const bd = dec(b);
  if (bd.isZero()) return null;
  return pct(dec(a).div(bd).times(100));
}

export function isZero(v: Numeric | null | undefined): boolean {
  return dec(v).isZero();
}
