"use server";
import { and, eq, isNull } from "drizzle-orm";
import { requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { subContracts } from "@/lib/db/schema";

export async function getSubContractAction(id: string) {
  await requireCapability("contracts.view");
  const [row] = await db.select().from(subContracts).where(and(eq(subContracts.id, id), isNull(subContracts.deletedAt)));
  return row ?? null;
}
