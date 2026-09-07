/**
 * Recurring results-update job — fills in `predictions.actual_result` for
 * matches that have finished but haven't been scored yet.
 *
 * Runs on a schedule via .github/workflows/results-update.yml (GitHub
 * Actions), not on Vercel — headless Chromium doesn't fit cleanly in a
 * serverless function (bundle size + execution time), and a GitHub Actions
 * runner is a full Ubuntu VM with no such limits. Playwright is installed
 * fresh in the workflow (see the workflow file) rather than added to
 * package.json, so it never touches the deployed app's dependencies or
 * slows down a Vercel build.
 *
 * Source of truth for scores is Flashscore, matched by team name against
 * LEAGUE_SOURCES slugs. Every result is stability-checked (the results page
 * is reloaded 3 times and must return identical data) before being trusted —
 * this project has hit at least one Flashscore anomaly before, and that
 * check exists specifically to catch a repeat. Nothing is guessed: a match
 * that can't be confidently identified, isn't finished yet, or is missing
 * half-time/corner data is skipped and reported, never filled in with a
 * best guess.
 */
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import { LEAGUE_SOURCES, flashscoreResultsUrl } from "../lib/league-sources";
import { deriveActualResult, type RawMatchResult } from "../lib/hydrate";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const HISTORY_WINDOW_MS = 48 * 3600 * 1000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface PendingPrediction {
  id: number;
  league_id: number;
  home_team: string;
  away_team: string;
  match_date: string;
}

interface ResultRow {
  matchId: string;
  home: string;
  away: string;
  homeScore: string | null;
  awayScore: string | null;
}

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

/** Corrections for cases where Flashscore's name doesn't line up with ours even after normalizing. */
const ALIASES: Record<string, string> = {
  "heart of midlothian": "hearts",
  odense: "ob",
  "atletico goianiense": "atletico go",
  "colon santa fe": "colon",
  "deportivo moron": "moron",
};

function canonical(name: string): string {
  const n = normalizeTeamName(name);
  return ALIASES[n] ?? n;
}

function namesMatch(a: string, b: string): boolean {
  const ca = canonical(a);
  const cb = canonical(b);
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

async function scrapeResultsOnce(page: Page, url: string): Promise<ResultRow[]> {
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
  return page.evaluate(() => {
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
      const homeScore = el.querySelector(".event__score--home")?.textContent?.trim() ?? null;
      const awayScore = el.querySelector(".event__score--away")?.textContent?.trim() ?? null;
      const id = (el.getAttribute("id") ?? "").replace("g_1_", "");
      return { matchId: id, home, away, homeScore, awayScore };
    });
  });
}

function rowsEqual(a: ResultRow[], b: ResultRow[]): boolean {
  if (a.length !== b.length) return false;
  const key = (r: ResultRow) => `${r.matchId}|${r.home}|${r.away}|${r.homeScore}|${r.awayScore}`;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}

function parseCorners(statsText: string): { home: number; away: number } | null {
  const cornersMatch = statsText.match(/(\d+)\s*\n\s*Corner kicks\s*\n\s*(\d+)/i);
  return cornersMatch ? { home: Number(cornersMatch[1]), away: Number(cornersMatch[2]) } : null;
}

async function extractMatchDetail(
  page: Page,
  matchId: string,
): Promise<{
  ht: { home: number; away: number } | null;
  corners: { home: number; away: number } | null;
  htCorners: { home: number; away: number } | null;
}> {
  const url = `https://www.flashscore.com/match/football/${matchId}/#/match-summary`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  const summaryText = await page.evaluate(() => document.body.innerText);
  const htMatch = summaryText.match(/1ST HALF\s*\n\s*(\d+)\s*-\s*(\d+)/i);
  const ht = htMatch ? { home: Number(htMatch[1]), away: Number(htMatch[2]) } : null;

  let corners: { home: number; away: number } | null = null;
  let htCorners: { home: number; away: number } | null = null;
  try {
    await page.getByText("Stats", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    const statsText = await page.evaluate(() => document.body.innerText);
    corners = parseCorners(statsText);

    // The full-match Stats view (".../stats/overall/?mid=...") has sibling
    // "1st Half"/"2nd Half" period tabs at the same URL shape with "overall"
    // swapped out — confirmed live: a match with 6-7 full-match corners
    // showed a genuinely different 2-3 split on the 1st-half URL, not a
    // duplicate of the full-match numbers. Navigating there directly is far
    // more reliable than clicking the tab (clicking it round-tripped back to
    // the same full-match numbers in testing, likely an SPA routing quirk).
    const statsUrl = page.url();
    if (statsUrl.includes("/stats/overall/")) {
      try {
        await page.goto(statsUrl.replace("/stats/overall/", "/stats/1st-half/"), {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(2000);
        const htStatsText = await page.evaluate(() => document.body.innerText);
        htCorners = parseCorners(htStatsText);
      } catch {
        // 1st-half stats view unavailable for this match — htCorners stays
        // null (RawMatchResult.htCorners is optional for exactly this case),
        // it doesn't block recording the rest of the result.
      }
    }
  } catch {
    // Stats tab not available/clickable — corners stay null, reported as a skip.
  }

  return { ht, corners, htCorners };
}

async function main() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - HISTORY_WINDOW_MS);

  const { data: pending, error } = await supabase
    .from("predictions")
    .select("id, league_id, home_team, away_team, match_date")
    .is("actual_result", null)
    .gte("match_date", cutoff.toISOString())
    .lte("match_date", now.toISOString())
    .order("match_date", { ascending: true });

  if (error) {
    console.error("Failed to query pending predictions:", error.message);
    process.exit(1);
  }

  const allPending = (pending ?? []) as PendingPrediction[];
  console.log(`Checking ${allPending.length} pending prediction(s) from the last 48h...`);

  const byLeague = new Map<number, PendingPrediction[]>();
  for (const p of allPending) {
    const list = byLeague.get(p.league_id) ?? [];
    list.push(p);
    byLeague.set(p.league_id, list);
  }

  const sourceByLeagueId = new Map(LEAGUE_SOURCES.map((s) => [s.leagueId, s]));

  const noSlugLeagues = new Set<number>();
  const unstableLeagues = new Set<number>();
  const matched: { prediction: PendingPrediction; row: ResultRow }[] = [];
  const notFinished: PendingPrediction[] = [];
  const noMatch: PendingPrediction[] = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: USER_AGENT });

  for (const [leagueId, preds] of byLeague) {
    const source = sourceByLeagueId.get(leagueId);
    if (!source) {
      noSlugLeagues.add(leagueId);
      continue;
    }

    const url = flashscoreResultsUrl(source.slug);
    let snapshots: ResultRow[][];
    try {
      snapshots = [await scrapeResultsOnce(page, url), await scrapeResultsOnce(page, url), await scrapeResultsOnce(page, url)];
    } catch (e) {
      console.log(`[${source.leagueName}] scrape failed: ${(e as Error).message}`);
      unstableLeagues.add(leagueId);
      continue;
    }

    const stable = rowsEqual(snapshots[0], snapshots[1]) && rowsEqual(snapshots[1], snapshots[2]);
    if (!stable) {
      console.log(`[${source.leagueName}] results page unstable across reloads, skipping`);
      unstableLeagues.add(leagueId);
      continue;
    }

    const rows = snapshots[0];
    for (const pred of preds) {
      const candidates = rows.filter((r) => namesMatch(r.home, pred.home_team) && namesMatch(r.away, pred.away_team));
      if (candidates.length !== 1) {
        noMatch.push(pred);
        continue;
      }
      const row = candidates[0];
      if (!row.homeScore || !row.awayScore || !/^\d+$/.test(row.homeScore) || !/^\d+$/.test(row.awayScore)) {
        notFinished.push(pred);
        continue;
      }
      matched.push({ prediction: pred, row });
    }
  }

  console.log(`Matched ${matched.length} finished game(s), fetching half-time/corner detail...`);

  let updatedCount = 0;
  const detailFailures: { prediction: PendingPrediction; reason: string }[] = [];

  for (const { prediction, row } of matched) {
    try {
      const { ht, corners, htCorners } = await extractMatchDetail(page, row.matchId);
      if (!ht) {
        detailFailures.push({ prediction, reason: "could not extract half-time score" });
        continue;
      }
      if (!corners) {
        detailFailures.push({ prediction, reason: "could not extract corner kicks" });
        continue;
      }

      const raw: RawMatchResult = {
        finalScore: { home: Number(row.homeScore), away: Number(row.awayScore) },
        htScore: ht,
        corners,
        htCorners,
      };
      const actualResult = deriveActualResult(raw);

      // Re-check right before writing — nothing else should be racing this
      // job, but never overwrite a result that's already been recorded.
      const { data: existing } = await supabase
        .from("predictions")
        .select("actual_result")
        .eq("id", prediction.id)
        .maybeSingle();
      if (existing?.actual_result !== null) continue;

      const { error: updateError } = await supabase
        .from("predictions")
        .update({ actual_result: actualResult })
        .eq("id", prediction.id);

      if (updateError) {
        detailFailures.push({ prediction, reason: `db update failed: ${updateError.message}` });
      } else {
        updatedCount += 1;
      }
    } catch (e) {
      detailFailures.push({ prediction, reason: `scrape error: ${(e as Error).message}` });
    }
  }

  await browser.close();

  console.log("\n=== Results-update summary ===");
  console.log(`Checked: ${allPending.length}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Not finished yet: ${notFinished.length}`);
  console.log(`No confident match on Flashscore: ${noMatch.length}`);
  console.log(`No league slug configured: ${[...noSlugLeagues].join(", ") || "none"}`);
  console.log(`Unstable/failed league scrape: ${[...unstableLeagues].join(", ") || "none"}`);
  if (detailFailures.length > 0) {
    console.log(`Matched but detail extraction failed (${detailFailures.length}):`);
    for (const f of detailFailures) {
      console.log(`  - ${f.prediction.home_team} vs ${f.prediction.away_team}: ${f.reason}`);
    }
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
