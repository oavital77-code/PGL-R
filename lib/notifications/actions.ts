"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { markRead } from "./service";

export async function markNotificationsRead(ids: string[] | "all") {
  const user = await requireUser();
  await markRead(user.id, ids);
  revalidatePath("/", "layout");
}
