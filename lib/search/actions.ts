"use server";
import { requireUser } from "@/lib/auth/current-user";
import { globalSearch, type SearchHit } from "./global-search";

export async function searchAction(q: string): Promise<SearchHit[]> {
  const user = await requireUser();
  return globalSearch(user, q);
}
