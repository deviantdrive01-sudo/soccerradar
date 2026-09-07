import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram-commands";
import type { TelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("x-telegram-bot-api-secret-token");
  return header === process.env.TELEGRAM_WEBHOOK_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;

  try {
    await handleTelegramUpdate(update);
  } catch (err) {
    // Telegram retries on non-2xx, which would just replay the same update —
    // log and acknowledge instead so one bad update can't loop forever.
    console.error("Telegram webhook handler failed:", err);
  }

  return NextResponse.json({ ok: true });
}
