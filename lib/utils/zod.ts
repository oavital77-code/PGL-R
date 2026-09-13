import { z } from "zod";

/** "" → undefined, so optional inputs from forms validate. */
export const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
export const optionalString = z.preprocess(emptyToUndef, z.string().trim().max(2000).optional());
export const optionalEmail = z.preprocess(emptyToUndef, z.email().optional());
export const optionalDate = z.preprocess(emptyToUndef, z.iso.date().optional());
export const optionalUuid = z.preprocess(emptyToUndef, z.uuid().optional());
export const optionalNumber = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().optional());
export const optionalInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().int().optional());
export const boolFromForm = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1", z.boolean());
export const money = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().min(-999_999_999).max(999_999_999));
export const pct = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().min(0).max(100));
export const isoDate = z.iso.date();
export const uuid = z.uuid();
