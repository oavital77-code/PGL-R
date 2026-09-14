import "server-only";
import { eq } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { parseSetting, type SettingsKey, type SettingsValue } from "./defaults";

const TAG = "settings";

const loadRaw = unstable_cache(
  async (key: string) => {
    const rows = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  },
  ["settings-get"],
  { tags: [TAG], revalidate: 60 },
);

/** Read a setting with defaults applied. Cached ≤ 60s (spec §3.3). */
export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsValue<K>> {
  let raw: unknown;
  try {
    raw = await loadRaw(key);
  } catch {
    // outside a Next.js request scope (cron scripts, tests): read directly
    const rows = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
    raw = rows[0]?.value ?? null;
  }
  return parseSetting(key, raw);
}

/** Read a setting bypassing the cache (inside transactions / numbering). */
export async function getSettingFresh<K extends SettingsKey>(key: K, tx: { select: typeof db.select } = db): Promise<SettingsValue<K>> {
  const rows = await tx.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return parseSetting(key, rows[0]?.value ?? null);
}

export async function setSetting<K extends SettingsKey>(key: K, value: SettingsValue<K>, updatedBy: string | null, tx: { insert: typeof db.insert } = db) {
  const parsed = parseSetting(key, value);
  await tx
    .insert(settings)
    .values({ key, value: parsed, updatedBy })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedBy, updatedAt: new Date() } });
  invalidateSettings();
  return parsed;
}

export async function patchSetting<K extends SettingsKey>(key: K, patch: Partial<SettingsValue<K>>, updatedBy: string | null) {
  const current = await getSettingFresh(key);
  return setSetting(key, { ...current, ...patch }, updatedBy);
}

/** Safe outside a Next request context (cron/tests). */
export function invalidateSettings() {
  try {
    revalidateTag(TAG);
  } catch {
    /* not in a Next.js request scope */
  }
}
