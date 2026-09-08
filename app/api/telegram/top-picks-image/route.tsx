import { ImageResponse } from "next/og";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { ShareImageTemplate, SHARE_IMAGE_OPTIONS_LARGE, type ShareImageItem } from "@/lib/share-image";
import { isPredicted } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// Shows up to this many rows in the image itself (the template's "+N more"
// footer covers the rest) — the query cap below is just a generous safety
// bound so a freak high-volume day can't blow up the render, not a display cap.
const MAX_VISIBLE_IN_IMAGE = 8;
const QUERY_CAP = 40;

/** Renders the same branded share-image template used for bookings/collections/top-picks, fed with today's top predictions — used by the Telegram bot's /predictions command and the daily Channel broadcast. */
export async function GET() {
  const supabase = createSupabaseReadClient();
  const now = new Date();
  const dayAhead = new Date(now.getTime() + 24 * 3600 * 1000);

  const [{ data: predictions }, { data: leagues }] = await Promise.all([
    supabase
      .from("predictions")
      .select("*")
      .not("markets", "is", null)
      .gte("match_date", now.toISOString())
      .lte("match_date", dayAhead.toISOString())
      .order("confidence", { ascending: false })
      .limit(QUERY_CAP),
    supabase.from("leagues").select("id, name"),
  ]);
  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l.name]));

  const items: ShareImageItem[] = (predictions ?? [])
    .map((p) => {
      if (!isPredicted(p)) return null;
      return {
        home: p.home_team,
        away: p.away_team,
        detail: `${leagueById.get(p.league_id) ?? ""} · ${p.markets.outcome.label} (${p.confidence}%)`,
      };
    })
    .filter((i): i is ShareImageItem => i !== null);

  return new ImageResponse(
    <ShareImageTemplate title="Today's Top Picks" ownerLabel="SoccerRadar" items={items} maxVisible={MAX_VISIBLE_IN_IMAGE} />,
    SHARE_IMAGE_OPTIONS_LARGE,
  );
}
