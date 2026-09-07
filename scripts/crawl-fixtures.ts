/**
 * Fixture-discovery job — finds upcoming fixtures from Flashscore and
 * inserts bare rows into `predictions` immediately (markets/confidence/
 * summary left null). This is stage 1 of a two-stage pipeline:
 *   1. crawl-fixtures.ts (this file)   — fixture goes live on the site right away.
 *   2. generate-predictions.ts         — fills markets/confidence/summary in
 *                                         later, updating the same row in place.
 *
 * Split out from what used to be a single update-predictions.ts so a fixture
 * doesn't stay invisible on the site while it waits on the much slower,
 * costlier, more failure-prone H2H-scrape + Claude half of the pipeline.
 *
 * Runs on a schedule via .github/workflows/crawl-fixtures.yml — headless
 * Chromium doesn't fit cleanly in a Vercel serverless function, so this runs
 * on a GitHub Actions runner instead, same as update-results.ts.
 */
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import { LEAGUE_SOURCES, flashscoreFixturesUrl } from "../lib/league-sources";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FIXTURE_WINDOW_DAYS = 3; // how far ahead to look for new fixtures each run

// ---------- team-name matching (same approach as update-results.ts) ----------

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[.''`´-]/g, " ")
    .replace(/\butd\b/g, "united")
    .replace(/\b(fc|cf|sc|ac|afc|cfk|sfk|cd|ca|club|de|do|da|w)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function namesMatch(a: string, b: string): boolean {
  const ca = normalizeTeamName(a);
  const cb = normalizeTeamName(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const wordsA = new Set(ca.split(" ").filter((w) => w.length > 1));
  const wordsB = new Set(cb.split(" ").filter((w) => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const [shorter, longer] = wordsA.size <= wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
  let overlap = 0;
  for (const w of shorter) if (longer.has(w)) overlap++;
  return overlap === shorter.size && overlap > 0;
}

// ---------- Flashscore fixture discovery ----------

interface FixtureRow {
  matchId: string;
  home: string;
  away: string;
  kickoff: string; // ISO
}

/** "07.09. 18:00" (Flashscore's dd.mm. format, no year) -> a full ISO datetime. */
function parseFlashscoreDateTime(dateText: string): string | null {
  const match = dateText.match(/(\d{2})\.(\d{2})\.\s*(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, hour, minute] = match;
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(Date.UTC(year, Number(month) - 1, Number(day), Number(hour), Number(minute)));
  // Fixtures pages only show near-term matches — if this date lands more than
  // a month in the past relative to now, it must actually be next year (only
  // realistically hit right around New Year's).
  if (candidate.getTime() < now.getTime() - 30 * 24 * 3600 * 1000) {
    year += 1;
  }
  return new Date(Date.UTC(year, Number(month) - 1, Number(day), Number(hour), Number(minute))).toISOString();
}

async function scrapeFixturesOnce(page: Page, url: string): Promise<FixtureRow[]> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 2; i++) {
    try {
      await page.getByText(/show more matches/i).first().click({ timeout: 1500 });
      await page.waitForTimeout(1200);
    } catch {
      break;
    }
  }
  const raw = await page.evaluate(() => {
    const els = document.querySelectorAll('[id^="g_1_"]');
    return Array.from(els).map((el) => {
      const home =
        el.querySelector(".event__homeParticipant .wcl-name_jjfMf")?.textContent?.trim() ??
        el.querySelector(".event__homeParticipant")?.textContent?.trim() ??
        "";
      const away =
        el.querySelector(".event__awayParticipant .wcl-name_jjfMf")?.textContent?.trim() ??
        el.querySelector(".event__awayParticipant")?.textContent?.trim() ??
        "";
      const dateText = el.querySelector(".wcl-dateContent_eEChT")?.textContent?.trim() ?? "";
      const id = (el.getAttribute("id") ?? "").replace("g_1_", "");
      return { id, home, away, dateText };
    });
  });

  const rows: FixtureRow[] = [];
  for (const r of raw) {
    const kickoff = parseFlashscoreDateTime(r.dateText);
    if (kickoff && r.home && r.away && r.id) rows.push({ matchId: r.id, home: r.home, away: r.away, kickoff });
  }
  return rows;
}

function rowsEqual(a: FixtureRow[], b: FixtureRow[]): boolean {
  if (a.length !== b.length) return false;
  const key = (r: FixtureRow) => `${r.matchId}|${r.home}|${r.away}|${r.kickoff}`;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}

// ---------- main ----------

async function main() {
  const { data: leagues, error: leaguesError } = await supabase.from("leagues").select("*").eq("is_active", true);
  if (leaguesError) {
    console.error("Failed to load leagues:", leaguesError.message);
    process.exit(1);
  }

  const sourceByLeagueId = new Map(LEAGUE_SOURCES.map((s) => [s.leagueId, s]));
  const now = new Date();
  const windowEnd = new Date(now.getTime() + FIXTURE_WINDOW_DAYS * 24 * 3600 * 1000);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: USER_AGENT });

  const noSlugLeagues: string[] = [];
  const unstableLeagues: string[] = [];
  const newRows: {
    league_id: number;
    match_id: string;
    home_team: string;
    away_team: string;
    match_date: string;
  }[] = [];

  for (const league of leagues) {
    const source = sourceByLeagueId.get(league.id);
    if (!source) {
      noSlugLeagues.push(league.name);
      continue;
    }

    const url = flashscoreFixturesUrl(source.slug);
    let snapshots: FixtureRow[][];
    try {
      snapshots = [await scrapeFixturesOnce(page, url), await scrapeFixturesOnce(page, url), await scrapeFixturesOnce(page, url)];
    } catch (e) {
      console.log(`[${league.name}] scrape failed: ${(e as Error).message}`);
      unstableLeagues.push(league.name);
      continue;
    }
    if (!rowsEqual(snapshots[0], snapshots[1]) || !rowsEqual(snapshots[1], snapshots[2])) {
      console.log(`[${league.name}] fixtures page unstable across reloads, skipping`);
      unstableLeagues.push(league.name);
      continue;
    }

    const upcoming = snapshots[0].filter((r) => {
      const t = new Date(r.kickoff).getTime();
      return t >= now.getTime() && t <= windowEnd.getTime();
    });
    if (upcoming.length === 0) continue;

    const { data: existing } = await supabase
      .from("predictions")
      .select("home_team, away_team")
      .eq("league_id", league.id)
      .gte("match_date", now.toISOString())
      .lte("match_date", windowEnd.toISOString());

    for (const row of upcoming) {
      const alreadyExists = (existing ?? []).some(
        (p) => namesMatch(p.home_team, row.home) && namesMatch(p.away_team, row.away),
      );
      if (!alreadyExists) {
        newRows.push({
          league_id: league.id,
          match_id: row.matchId,
          home_team: row.home,
          away_team: row.away,
          match_date: row.kickoff,
        });
      }
    }
  }

  await browser.close();

  if (newRows.length === 0) {
    console.log("\n=== Crawl-fixtures summary ===");
    console.log("New fixtures inserted: 0");
    console.log(`No league slug configured: ${noSlugLeagues.join(", ") || "none"}`);
    console.log(`Unstable/failed league scrape: ${unstableLeagues.join(", ") || "none"}`);
    return;
  }

  if (process.env.DRY_RUN === "1") {
    console.log("\n=== DRY RUN — not writing to the DB ===");
    console.log(JSON.stringify(newRows, null, 2));
    return;
  }

  const { error: upsertError } = await supabase.from("predictions").upsert(newRows, { onConflict: "match_id" });
  if (upsertError) {
    console.error("Failed to insert fixtures:", upsertError.message);
    process.exit(1);
  }

  console.log("\n=== Crawl-fixtures summary ===");
  console.log(`New fixtures inserted: ${newRows.length}`);
  console.log(`No league slug configured: ${noSlugLeagues.join(", ") || "none"}`);
  console.log(`Unstable/failed league scrape: ${unstableLeagues.join(", ") || "none"}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
