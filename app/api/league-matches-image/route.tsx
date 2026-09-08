import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { getTeamCrestDataUri } from "@/lib/team-crest";
import { dateKey, dateLabel } from "@/lib/date-key";
import { isPredicted } from "@/lib/supabase/types";
import {
  LeagueMatchesImageTemplate,
  LEAGUE_MATCHES_IMAGE_WIDTH,
  LEAGUE_MATCHES_MAX_VISIBLE,
  LEAGUE_MATCHES_IMAGE_OPTIONS_FONTS,
  leagueMatchesImageHeight,
  type LeagueMatchesImageMatch,
} from "@/lib/league-matches-image";

export const dynamic = "force-dynamic";

const DEFAULT_TIME_ZONE = "Europe/London";

/** Same validate-before-trust pattern as the single-match Match Day image route. */
function resolveTimeZone(tz: string | null): string {
  if (!tz) return DEFAULT_TIME_ZONE;
  try {
    new Date().toLocaleTimeString("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/**
 * Downloadable fixture-list graphic for one league group — exactly the
 * matches the caller passed (the dashboard already knows which predictions
 * are in a given league/date group; this route just renders them), so it
 * always matches what's on screen regardless of the active date filter.
 */
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = [...new Set(idsParam.split(",").map(Number))].filter((n) => Number.isInteger(n));
  if (ids.length === 0) {
    return new Response("Missing or invalid ids", { status: 400 });
  }

  const timeZone = resolveTimeZone(req.nextUrl.searchParams.get("tz"));
  const supabase = createSupabaseReadClient();

  const { data: predictions } = await supabase.from("predictions").select("*").in("id", ids);
  const rows = (predictions ?? []).filter(isPredicted).sort((a, b) => a.match_date.localeCompare(b.match_date));
  if (rows.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const { data: league } = await supabase.from("leagues").select("name, country").eq("id", rows[0].league_id).maybeSingle();
  const leagueLabel = league ? `${league.country} · ${league.name}` : "";

  const dateKeys = new Set(rows.map((r) => dateKey(r.match_date)));
  const headerDateLabel = dateKeys.size === 1 ? dateLabel(rows[0].match_date) : "Upcoming Fixtures";

  const timeLabels = new Set(rows.map((r) => new Date(r.match_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone })));
  const headerTimeLabel = timeLabels.size === 1 ? [...timeLabels][0] : null;

  const visible = rows.slice(0, LEAGUE_MATCHES_MAX_VISIBLE);
  const moreCount = rows.length - visible.length;

  const crestUrls = await Promise.all(
    visible.flatMap((r) => [getTeamCrestDataUri(r.home_team), getTeamCrestDataUri(r.away_team)]),
  );

  const matches: LeagueMatchesImageMatch[] = visible.map((r, i) => ({
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    homeCrestUrl: crestUrls[i * 2],
    awayCrestUrl: crestUrls[i * 2 + 1],
  }));

  return new ImageResponse(
    (
      <LeagueMatchesImageTemplate
        leagueLabel={leagueLabel}
        dateLabel={headerDateLabel}
        timeLabel={headerTimeLabel}
        matches={matches}
        moreCount={moreCount}
      />
    ),
    { width: LEAGUE_MATCHES_IMAGE_WIDTH, height: leagueMatchesImageHeight(visible.length), fonts: LEAGUE_MATCHES_IMAGE_OPTIONS_FONTS },
  );
}
