/**
 * Recurring predictions job — discovers upcoming fixtures from Flashscore
 * (rather than API-Football's weekly-only cron, which misses anything
 * confirmed mid-week) and generates AI predictions for any that aren't
 * already in the `predictions` table.
 *
 * Runs on a schedule via .github/workflows/update-predictions.yml, same
 * reasoning as update-results.ts: headless Chromium doesn't fit cleanly in
 * a Vercel serverless function, so this runs on a GitHub Actions runner
 * instead. Playwright is installed fresh in the workflow job (--no-save),
 * never added to package.json.
 *
 * For each new fixture, this also scrapes real head-to-head corner data —
 * the last 3 meetings between these two exact teams, with the actual total
 * corner count pulled from each past match's own Stats tab (the same
 * extraction already proven in update-results.ts). The previous
 * API-Football-based pipeline's prompt claimed to use "corner counts from
 * their last 3 meetings" but never actually supplied that data (API-
 * Football's basic head-to-head endpoint has no corner stats) — this fixes
 * that gap with real numbers instead of removing the claim.
 *
 * This file duplicates a slimmed-down version of lib/prediction-engine.ts's
 * prompt/batching logic rather than importing it directly, because that
 * module (and lib/api-football.ts) are marked `import "server-only"`,
 * which throws when loaded outside Next.js's server bundler — the same
 * reason update-results.ts reimplements its own team-name normalization
 * instead of importing a guarded module.
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { chromium, type Page } from "playwright";
import { LEAGUE_SOURCES, flashscoreFixturesUrl } from "../lib/league-sources";
import { hydratePrediction, isCompactPrediction, type HydratedPrediction } from "../lib/hydrate";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ANTHROPIC_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FIXTURE_WINDOW_DAYS = 3; // how far ahead to look for new fixtures each run
const MAX_H2H_MEETINGS = 3; // capped to bound the extra scraping this adds per fixture
const BATCH_SIZE = 8;
const DEFAULT_MODEL = "claude-sonnet-5";

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

// ---------- H2H + corner history ----------

interface H2hRow {
  date: string;
  competition: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  mid: string;
}

interface H2hSections {
  headToHead: H2hRow[];
  homeTeamForm: H2hRow[];
  awayTeamForm: H2hRow[];
}

async function scrapeH2hSections(page: Page, matchId: string): Promise<H2hSections> {
  const url = `https://www.flashscore.com/match/football/${matchId}/#/h2h/overall`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  try {
    await page.getByText("H2H", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch {
    // No H2H tab available for this fixture — sections stay empty.
  }

  const sections = await page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll(".h2h__section"));
    return blocks.map((block) => {
      const heading = block.querySelector('[data-testid="wcl-headerSection-text"]')?.textContent?.trim() ?? "";
      const rows = Array.from(block.querySelectorAll("a.h2h__row")).map((a) => {
        const href = a.getAttribute("href") ?? "";
        const midMatch = href.match(/[?&]mid=([^&]+)/);
        const date = a.querySelector(".wclH2h__date .wcl-dateContent_eEChT")?.textContent?.trim() ?? "";
        const competition = a.querySelector(".h2h__event")?.textContent?.trim() ?? "";
        const home = a.querySelector(".h2h__homeParticipant .wcl-name_jjfMf")?.textContent?.trim() ?? "";
        const away = a.querySelector(".h2h__awayParticipant .wcl-name_jjfMf")?.textContent?.trim() ?? "";
        const scoreSpans = Array.from(a.querySelectorAll(".h2h__result span"));
        const homeScore = scoreSpans[0]?.textContent?.trim() ?? "";
        const awayScore = scoreSpans[1]?.textContent?.trim() ?? "";
        return { mid: midMatch ? midMatch[1] : "", date, competition, home, away, homeScore, awayScore };
      });
      return { heading, rows };
    });
  });

  function toH2hRows(rows: typeof sections[number]["rows"]): H2hRow[] {
    return rows
      .filter((r) => r.mid && /^\d+$/.test(r.homeScore) && /^\d+$/.test(r.awayScore))
      .map((r) => ({
        date: r.date,
        competition: r.competition,
        home: r.home,
        away: r.away,
        homeScore: Number(r.homeScore),
        awayScore: Number(r.awayScore),
        mid: r.mid,
      }));
  }

  const headToHead = toH2hRows(sections.find((s) => s.heading === "Head-to-head matches")?.rows ?? []).slice(
    0,
    MAX_H2H_MEETINGS,
  );
  const homeTeamForm = toH2hRows(sections.find((s) => s.heading.startsWith("Last matches:"))?.rows ?? []);
  const awayTeamForm = toH2hRows(
    sections.filter((s) => s.heading.startsWith("Last matches:"))[1]?.rows ?? [],
  );

  return { headToHead, homeTeamForm, awayTeamForm };
}

/** Reuses the exact corner-extraction approach proven in update-results.ts. */
async function extractCorners(page: Page, matchId: string): Promise<{ home: number; away: number } | null> {
  const url = `https://www.flashscore.com/match/football/${matchId}/#/match-summary`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.getByText("Stats", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1800);
    const statsText = await page.evaluate(() => document.body.innerText);
    const cornersMatch = statsText.match(/(\d+)\s*\n\s*Corner kicks\s*\n\s*(\d+)/i);
    if (!cornersMatch) return null;
    return { home: Number(cornersMatch[1]), away: Number(cornersMatch[2]) };
  } catch {
    return null;
  }
}

// ---------- Claude prediction generation (slimmed-down copy of prediction-engine.ts) ----------

const SYSTEM_PROMPT = `You are a football (soccer) prediction analyst for SoccerRadar.

For each fixture provided, analyze the supplied stats (recent form, head-to-head, home/away splits) and predict the following markets. Respond ONLY with a compact JSON array — no prose, no markdown fences, no explanation outside the JSON.

Each array element must have EXACTLY these keys:
- "id": the match_id (string), copied from the input exactly as given
- "o": full-time outcome, one of "1" (home win) | "X" (draw) | "2" (away win)
- "ht": first-half-only outcome (goals scored in the 1st half only), same coding as "o"
- "h2": second-half-only outcome (goals scored in the 2nd half only), same coding as "o" — predict this independently, don't just infer it from "o" and "ht", since a team can win the match overall while losing the second-half goal battle outright
- "sh": highest scoring half, one of "1st" | "2nd" | "Equal"
- "g": [over_1_5, over_2_5] each 0 or 1, whether total goals will exceed that line
- "c": [over_7_5, over_8_5, ht_over_3_5] each 0 or 1, corner count over that line (last value is first-half corners over 3.5)
- "conf": integer confidence score 1-100 for this prediction set
- "sum": one short sentence (max ~25 words) of tactical reasoning

Corner-market methodology: weigh head-to-head history for these two specific teams at least as heavily as current form. Each entry in headToHead may include a "corners" field with the real total corner count from that specific past meeting (home + away, scraped from that match's own stats) — when present, use these actual numbers rather than estimating from form:
- If the available corners figures consistently run high between these two teams, treat it as a strong signal corners will be high again this time — head-to-head tendencies between specific opponents tend to repeat (tactical matchups, playing styles) more than random chance would suggest.
- If at least 2 of the available meetings had low corner counts, treat that as a red flag against the over lines, even if current form looks corner-heavy.
- Some headToHead entries may have "corners": null (not available for that match) — ignore those entries for the corner read specifically, and base it only on entries where real corner data is present.
- Head-to-head history should inform the prediction, not override it outright — still weigh current form, and fall back to current form and team style when head-to-head data is sparse, absent, or no entries have corner data available.

Output strictly valid JSON: an array of objects with exactly those keys, no additional keys, no trailing commentary.`;

interface FixtureContext {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  kickoff: string;
  stats: {
    headToHead: (H2hRow & { corners: { home: number; away: number } | null })[];
    homeTeamForm: H2hRow[];
    awayTeamForm: H2hRow[];
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function extractJsonArray(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON array found in model response");
  return candidate.slice(start, end + 1);
}

async function predictBatch(client: Anthropic, batch: FixtureContext[]): Promise<HydratedPrediction[]> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const userPayload = batch.map((f) => ({
    id: f.matchId,
    league: f.leagueName,
    kickoff: f.kickoff,
    home: f.homeTeam,
    away: f.awayTeam,
    stats: f.stats,
  }));

  const response = await client.messages.create({
    model,
    max_tokens: 400 * batch.length,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text content in Claude response");

  const json = extractJsonArray(textBlock.text);
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("Model response JSON is not an array");
  return parsed.filter(isCompactPrediction).map(hydratePrediction);
}

async function generatePredictions(fixtures: FixtureContext[]): Promise<HydratedPrediction[]> {
  if (fixtures.length === 0) return [];
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const results: HydratedPrediction[] = [];
  for (const batch of chunk(fixtures, BATCH_SIZE)) {
    results.push(...(await predictBatch(client, batch)));
  }
  return results;
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
  const newFixtures: { league: (typeof leagues)[number]; row: FixtureRow }[] = [];

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
      if (!alreadyExists) newFixtures.push({ league, row });
    }
  }

  console.log(`Found ${newFixtures.length} new fixture(s) needing predictions (next ${FIXTURE_WINDOW_DAYS} days).`);

  const fixtureContexts: FixtureContext[] = [];
  for (const { league, row } of newFixtures) {
    const h2h = await scrapeH2hSections(page, row.matchId);

    const headToHeadWithCorners: FixtureContext["stats"]["headToHead"] = [];
    for (const meeting of h2h.headToHead) {
      const corners = await extractCorners(page, meeting.mid);
      headToHeadWithCorners.push({ ...meeting, corners });
    }

    fixtureContexts.push({
      matchId: row.matchId,
      homeTeam: row.home,
      awayTeam: row.away,
      leagueName: league.name,
      kickoff: row.kickoff,
      stats: {
        headToHead: headToHeadWithCorners,
        homeTeamForm: h2h.homeTeamForm,
        awayTeamForm: h2h.awayTeamForm,
      },
    });
  }

  await browser.close();

  if (fixtureContexts.length === 0) {
    console.log("\n=== Predictions-update summary ===");
    console.log("New fixtures: 0");
    console.log(`No league slug configured: ${noSlugLeagues.join(", ") || "none"}`);
    console.log(`Unstable/failed league scrape: ${unstableLeagues.join(", ") || "none"}`);
    return;
  }

  if (process.env.DRY_RUN === "1") {
    console.log("\n=== DRY RUN — not calling Claude or writing to the DB ===");
    console.log(JSON.stringify(fixtureContexts, null, 2));
    return;
  }

  console.log(`Generating predictions for ${fixtureContexts.length} fixture(s) via Claude...`);
  const predictions = await generatePredictions(fixtureContexts);

  const fixtureById = new Map(fixtureContexts.map((f) => [f.matchId, f]));
  const leagueByName = new Map(leagues.map((l) => [l.name, l]));
  const rows = predictions
    .map((prediction) => {
      const fixture = fixtureById.get(prediction.matchId);
      if (!fixture) return null;
      const league = leagueByName.get(fixture.leagueName);
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
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const { error: upsertError } = await supabase.from("predictions").upsert(rows, { onConflict: "match_id" });
  if (upsertError) {
    console.error("Failed to upsert predictions:", upsertError.message);
    process.exit(1);
  }

  console.log("\n=== Predictions-update summary ===");
  console.log(`New fixtures found: ${newFixtures.length}`);
  console.log(`Predictions generated & upserted: ${rows.length}`);
  console.log(`No league slug configured: ${noSlugLeagues.join(", ") || "none"}`);
  console.log(`Unstable/failed league scrape: ${unstableLeagues.join(", ") || "none"}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
