"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/admin/dal";
import { runScheduledBroadcast, type ScheduledBroadcastType, type ScheduledBroadcastResult } from "@/lib/telegram-broadcasts";

/**
 * Manually fires one scheduled broadcast slot right now — exactly the same
 * function the GitHub Actions cron calls, so it respects the same
 * once-per-day dedup (telegram_broadcast_log). Lets an admin push a slot
 * early, retry one that had nothing to post earlier in the day, or check
 * the channel actually works, without waiting for its real cron time.
 */
export async function triggerBroadcastAction(type: ScheduledBroadcastType): Promise<ScheduledBroadcastResult> {
  await verifySession();
  const result = await runScheduledBroadcast(type);

  revalidatePath("/admin/telegram");

  return result;
}
