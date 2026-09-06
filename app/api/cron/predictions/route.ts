import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { fetchWeeklyFixtures, fetchFixtureStats } from "@/lib/api-football";
import { generatePredictions, type FixtureContext } from "@/lib/prediction-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

function dateRange(days: number): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: toIso(now), to: toIso(end) };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: leagues, error: leaguesError } = await supabase
    .from("leagues")
    .select("*")
    .eq("is_active", true);

  if (leaguesError) {
    return NextResponse.json({ error: leaguesError.message }, { status: 500 });
  }

  const { from, to } = dateRange(7);
  const fixtureContexts: FixtureContext[] = [];

  for (const league of leagues) {
    try {
      const fixtures = await fetchWeeklyFixtures(league.api_league_id, from, to);

      for (const fixture of fixtures) {
        const stats = await fetchFixtureStats(fixture);
        fixtureContexts.push({
          matchId: String(fixture.fixture.id),
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          leagueName: league.name,
          kickoff: fixture.fixture.date,
          stats,
        });
      }
    } catch (err) {
      console.error(`Failed fetching fixtures for league ${league.name}:`, err);
    }
  }

  if (fixtureContexts.length === 0) {
    return NextResponse.json({ leaguesProcessed: leagues.length, fixturesProcessed: 0, predictionsUpserted: 0 });
  }

  const predictions = await generatePredictions(fixtureContexts);

  const fixtureById = new Map(fixtureContexts.map((f) => [f.matchId, f]));
  const rows = predictions
    .map((prediction) => {
      const fixture = fixtureById.get(prediction.matchId);
      if (!fixture) return null;

      const league = leagues.find((l) => l.name === fixture.leagueName);
      if (!league) return null;

      return {
        league_id: league.id,
        match_id: prediction.matchId,
        home_team: fixture.homeTeam,
        away_team: fixture.awayTeam,
        match_date: fixture.kickoff,
        markets: prediction.markets,
        confidence: prediction.confidence,
        summary: prediction.summary,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const { error: upsertError } = await supabase
    .from("predictions")
    .upsert(rows, { onConflict: "match_id" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  revalidatePath("/");

  return NextResponse.json({
    leaguesProcessed: leagues.length,
    fixturesProcessed: fixtureContexts.length,
    predictionsUpserted: rows.length,
  });
}
