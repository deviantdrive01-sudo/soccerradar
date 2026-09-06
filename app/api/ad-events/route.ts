import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AdEventType } from "@/lib/supabase/types";

const VALID_TYPES: AdEventType[] = ["impression", "click"];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = (body as { type?: unknown })?.type;
  if (typeof eventType !== "string" || !VALID_TYPES.includes(eventType as AdEventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("ad_events").insert({ event_type: eventType as AdEventType });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
