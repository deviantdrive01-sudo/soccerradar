import { NextRequest, NextResponse } from "next/server";
import { runScheduledBroadcast, type ScheduledBroadcastType } from "@/lib/telegram-broadcasts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_TYPES: ScheduledBroadcastType[] = [
  "top-bookings-1",
  "top-bookings-2",
  "top-bookings-3",
  "banger",
  "corners",
  "over15",
  "international",
  "top-match",
];

function isValidType(value: string | null): value is ScheduledBroadcastType {
  return value !== null && (VALID_TYPES as string[]).includes(value);
}

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

/** One route for all 8 scheduled broadcast slots (see lib/telegram-broadcasts.ts) — driven by .github/workflows/telegram-broadcasts.yml since this project's Vercel Hobby plan caps native cron at 2 jobs, once/day each. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");
  if (!isValidType(type)) {
    return NextResponse.json({ error: `Invalid or missing "type" — expected one of ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  const result = await runScheduledBroadcast(type);
  return NextResponse.json(result);
}
