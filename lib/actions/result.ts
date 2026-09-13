import { ZodError } from "zod";
import { AuthError, BusinessRuleError, NotFoundError, ValidationError } from "@/lib/auth/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, code?: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, code, fieldErrors };
}

/** Wrap a server action body: maps known errors to a serialisable result. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return fail("errors.validation", "VALIDATION", fieldErrors);
    }
    if (e instanceof ValidationError) return fail(e.message, "VALIDATION", e.fieldErrors);
    if (e instanceof AuthError) return fail(`errors.${e.code.toLowerCase()}`, e.code);
    if (e instanceof NotFoundError) return fail("errors.not_found", "NOT_FOUND");
    if (e instanceof BusinessRuleError) return fail(e.message, e.code);
    console.error(e);
    return fail("errors.unexpected", "UNEXPECTED");
  }
}

/** Helper for <form action> server actions: turn FormData into a plain object. */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$")) continue;
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      const arr = out[key] as unknown[] | undefined;
      if (arr) arr.push(v);
      else out[key] = [v];
    } else out[k] = v;
  }
  return out;
}
