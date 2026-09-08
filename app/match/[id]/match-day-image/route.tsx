import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { MatchDayImageTemplate, MATCH_DAY_IMAGE_OPTIONS } from "@/lib/match-day-image";
import { getTeamCrestDataUri } from "@/lib/team-crest";

export const dynamic = "force-dynamic";

const DEFAULT_TIME_ZONE = "Europe/London";

/** The button appends the viewer's own detected IANA zone — validate it actually works before trusting it, since a malformed/spoofed value throws inside toLocaleTimeString. */
function resolveTimeZone(tz: string | null): string {
  if (!tz) return DEFAULT_TIME_ZONE;
  try {
    new Date().toLocaleTimeString("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  const timeZone = resolveTimeZone(req.nextUrl.searchParams.get("tz"));

  const supabase = createSupabaseReadClient();
  const { data: prediction } = await supabase.from("predictions").select("*").eq("id", numericId).maybeSingle();

  if (!prediction) {
    return new Response("Not found", { status: 404 });
  }

  const { data: league } = await supabase.from("leagues").select("name, country").eq("id", prediction.league_id).maybeSingle();

  const [homeCrestUrl, awayCrestUrl] = await Promise.all([
    getTeamCrestDataUri(prediction.home_team),
    getTeamCrestDataUri(prediction.away_team),
  ]);

  const kickoffLabel = new Date(prediction.match_date).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

  return new ImageResponse(
    (
      <MatchDayImageTemplate
        homeTeam={prediction.home_team}
        awayTeam={prediction.away_team}
        homeCrestUrl={homeCrestUrl}
        awayCrestUrl={awayCrestUrl}
        leagueLabel={league ? `${league.country} · ${league.name}` : ""}
        kickoffLabel={kickoffLabel}
      />
    ),
    MATCH_DAY_IMAGE_OPTIONS,
  );
}
