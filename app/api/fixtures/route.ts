import { NextRequest, NextResponse } from "next/server";
import { fetchLiveFootballFixtures, fetchFootballFixturesByDate } from "@/lib/sports/football";
import { fetchLiveBasketballGames, fetchBasketballGamesByDate } from "@/lib/sports/basketball";
import type { Sport, SportFixture } from "@/lib/sports/types";
import { todayKey } from "@/lib/date-key";

// Basketball needs its own API_SPORTS_KEY (see lib/sports/api-sports-key.ts)
// which isn't configured yet, so an unspecified `sport` defaults to just
// football rather than a request that's guaranteed to fail half its calls.
// An explicit `sport=basketball` still goes through, surfacing that "not
// configured yet" error rather than silently 404ing.
function sportsToFetch(param: string | null): Sport[] {
  if (param === "basketball") return ["basketball"];
  return ["football"];
}

async function fixturesFor(sport: Sport, status: string, date: string): Promise<SportFixture[]> {
  if (status === "live") {
    return sport === "football" ? fetchLiveFootballFixtures() : fetchLiveBasketballGames();
  }
  return sport === "football" ? fetchFootballFixturesByDate(date) : fetchBasketballGamesByDate(date);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const sports = sportsToFetch(params.get("sport"));
  const status = params.get("status") === "live" ? "live" : "all";
  const date = params.get("date") ?? todayKey();

  try {
    const results = await Promise.all(sports.map((sport) => fixturesFor(sport, status, date)));
    const fixtures = results.flat().sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    return NextResponse.json({ fixtures });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load fixtures" },
      { status: 502 },
    );
  }
}
