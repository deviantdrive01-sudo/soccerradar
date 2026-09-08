import { NextRequest, NextResponse } from "next/server";
import { runScheduledBroadcast } from "@/lib/telegram-broadcasts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

/** The original 8AM digest — stays on its own dedicated Vercel Cron entry, now just a thin wrapper around the shared broadcast dispatcher (lib/telegram-broadcasts.ts) so /admin/telegram can also trigger and log it like every other scheduled post. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledBroadcast("general");
  return NextResponse.json(result);
}
