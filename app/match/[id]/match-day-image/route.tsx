import { ImageResponse } from "next/og";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { MatchDayImageTemplate, MATCH_DAY_IMAGE_OPTIONS } from "@/lib/match-day-image";
import { getTeamCrestDataUri } from "@/lib/team-crest";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);

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
    timeZone: "Europe/London",
    timeZoneName: "short",
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
