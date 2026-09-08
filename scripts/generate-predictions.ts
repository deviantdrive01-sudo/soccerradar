/**
 * Prediction-generation job — stage 2 of the two-stage pipeline (see
 * crawl-fixtures.ts for stage 1). Picks up bare fixture rows that
 * crawl-fixtures.ts already inserted (`markets is null`), scrapes real
 * head-to-head + corner history for each one directly from its own
 * match_id, generates predictions via Claude, and updates each row in
 * place — the same fixture the site is already showing, now filled in,
 * not a new row.
 *
 * Runs on a schedule via .github/workflows/generate-predictions.yml, offset
 * ~30 min after crawl-fixtures.yml so freshly-crawled rows are there to pick
 * up. Same reasoning as the other scripts for running via GitHub Actions
 * rather than a Vercel function: headless Chromium doesn't fit there.
 *
 * This file duplicates a slimmed-down version of lib/prediction-engine.ts's
 * prompt/batching logic rather than importing it directly, because that
 * module (and lib/api-football.ts) are marked `import "server-only"`, which
 * throws when loaded outside Next.js's server bundler.
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { chromium, type Page } from "playwright";
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
const MAX_H2H_MEETINGS = 3; // capped to bound the extra scraping this adds per fixture
const MAX_PENDING_PER_RUN = 60; // bounds Claude spend per run
const BATCH_SIZE = 8;
const DEFAULT_MODEL = "claude-sonnet-5";

// ---------- H2H + corner history (same approach as crawl-fixtures.ts's sibling, update-results.ts) ----------

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

  // A stale/invalid match_id (e.g. left over from the old API-Football
  // pipeline, which used numeric fixture ids that don't correspond to real
  // Flashscore match pages) loads Flashscore's own error page rather than
  // failing the navigation — must be treated as a scrape failure, not
  // silently recorded as "confirmed zero head-to-head meetings".
  const pageErrored = await page.evaluate(() =>
    document.body.innerText.includes("requested page can't be displayed"),
  );
  if (pageErrored) {
    throw new Error(`Invalid match page for match_id (Flashscore: "page can't be displayed")`);
  }

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
- "cs": [home_clean_sheet, away_clean_sheet] each 0 or 1, whether that side will concede zero goals
- "mc": independent integer confidence scores 1-100, one per market below — these are NOT all the same number, since your certainty genuinely varies market to market (e.g. very sure on the outcome but unsure on corners is normal and expected):
  - "o": confidence in the "o" pick
  - "ht": confidence in the "ht" pick
  - "h2": confidence in the "h2" pick
  - "sh": confidence in the "sh" pick
  - "g1": confidence in the over_1_5 pick
  - "g2": confidence in the over_2_5 pick
  - "c1": confidence in the over_7_5 corners pick
  - "c3": confidence in the ht_over_3_5 corners pick
  - "csh": confidence in the home_clean_sheet pick
  - "csa": confidence in the away_clean_sheet pick
- "conf": integer confidence score 1-100 for this prediction set overall
- "sum": one short sentence (max ~25 words) of tactical reasoning

Corner-market methodology: weigh head-to-head history for these two specific teams at least as heavily as current form. Each entry in headToHead may include a "corners" field with the real total corner count from that specific past meeting (home + away, scraped from that match's own stats) — when present, use these actual numbers rather than estimating from form:
- If the available corners figures consistently run high between these two teams, treat it as a strong signal corners will be high again this time — head-to-head tendencies between specific opponents tend to repeat (tactical matchups, playing styles) more than random chance would suggest.
- If at least 2 of the available meetings had low corner counts, treat that as a red flag against the over lines, even if current form looks corner-heavy.
- Some headToHead entries may have "corners": null (not available for that match) — ignore those entries for the corner read specifically, and base it only on entries where real corner data is present.
- Head-to-head history should inform the prediction, not override it outright — still weigh current form, and fall back to current form and team style when head-to-head data is sparse, absent, or no entries have corner data available.

Clean-sheet methodology: each headToHead entry includes the real final score from that past meeting — use it to gauge each side's defensive record against this specific opponent, not just their defensive record in general. If a team has shut the other out in most of the available meetings, treat that as a real signal regardless of current attacking form, since defensive struggles against a particular opponent's style/system tend to recur. Weigh current defensive form alongside it, and fall back to current form alone when head-to-head meetings are sparse or absent.

Outcome/goals methodology: the same real final scores in headToHead that inform clean sheets also apply directly to "o" and "g" — don't rely on current form alone when real history between these two exact teams is available. If these two teams' meetings have consistently produced high or low combined goal counts, weigh that alongside current form for the over/under lines — head-to-head scoring patterns between specific opponents (playing styles, tactical matchups) tend to repeat more than league-average form would suggest. Likewise, if one side has a lopsided head-to-head record against this specific opponent regardless of that side's overall current form, weigh that for "o" too. Still fall back to current form and team quality when head-to-head meetings are sparse, absent, or contradict each other with no clear pattern.

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
    // Bumped from 400/fixture: adding per-market confidence ("mc", 10 extra
    // numbers) and the clean-sheet market meaningfully grew the per-fixture
    // JSON output.
    max_tokens: 600 * batch.length,
    // This model defaults to adaptive extended thinking, which can consume
    // the entire max_tokens budget on internal reasoning and leave nothing
    // for the actual JSON output (hit in practice: stop_reason "max_tokens"
    // with a single "thinking" content block and no text block at all).
    // The task is a compact, deterministic classification with the
    // methodology already spelled out in the system prompt — thinking adds
    // cost and failure risk here, not quality.
    thinking: { type: "disabled" },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error(
      "No text content in Claude response. stop_reason:",
      response.stop_reason,
      "content block types:",
      response.content.map((b) => b.type),
      "usage:",
      response.usage,
    );
    throw new Error("No text content in Claude response");
  }

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
  const now = new Date();

  const { data: pending, error: pendingError } = await supabase
    .from("predictions")
    .select("id, league_id, match_id, home_team, away_team, match_date")
    .is("markets", null)
    .gte("match_date", now.toISOString())
    .order("match_date", { ascending: true })
    .limit(MAX_PENDING_PER_RUN);

  if (pendingError) {
    console.error("Failed to load pending fixtures:", pendingError.message);
    process.exit(1);
  }

  if (!pending || pending.length === 0) {
    console.log("\n=== Generate-predictions summary ===");
    console.log("Pending fixtures: 0");
    return;
  }

  const { data: leagues, error: leaguesError } = await supabase.from("leagues").select("id, name");
  if (leaguesError) {
    console.error("Failed to load leagues:", leaguesError.message);
    process.exit(1);
  }
  const leagueNameById = new Map(leagues.map((l) => [l.id, l.name]));

  console.log(`Found ${pending.length} pending fixture(s) needing predictions.`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: USER_AGENT });

  const fixtureContexts: FixtureContext[] = [];
  const skippedFixtures: string[] = [];

  for (const row of pending) {
    const leagueName = leagueNameById.get(row.league_id) ?? "Unknown league";
    try {
      const h2h = await scrapeH2hSections(page, row.match_id);

      const headToHeadWithCorners: FixtureContext["stats"]["headToHead"] = [];
      for (const meeting of h2h.headToHead) {
        const corners = await extractCorners(page, meeting.mid);
        headToHeadWithCorners.push({ ...meeting, corners });
      }

      fixtureContexts.push({
        matchId: row.match_id,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        leagueName,
        kickoff: row.match_date,
        stats: {
          headToHead: headToHeadWithCorners,
          homeTeamForm: h2h.homeTeamForm,
          awayTeamForm: h2h.awayTeamForm,
        },
      });
    } catch (err) {
      // A single flaky page load (Flashscore navigation timeout, etc.) must
      // not sink the whole batch — skip this fixture and let it get picked
      // up fresh on the next scheduled run rather than generating a
      // prediction from thin/absent stats.
      const label = `${row.home_team} vs ${row.away_team} (${leagueName})`;
      console.warn(`Skipping ${label} — H2H scrape failed:`, err instanceof Error ? err.message : err);
      skippedFixtures.push(label);
    }
  }

  await browser.close();

  if (fixtureContexts.length === 0) {
    console.log("\n=== Generate-predictions summary ===");
    console.log(`Pending fixtures: ${pending.length}`);
    console.log("Predictions generated: 0");
    console.log(`Skipped (H2H scrape failed): ${skippedFixtures.join(", ") || "none"}`);
    return;
  }

  if (process.env.DRY_RUN === "1") {
    console.log("\n=== DRY RUN — not calling Claude or writing to the DB ===");
    console.log(JSON.stringify(fixtureContexts, null, 2));
    return;
  }

  console.log(`Generating predictions for ${fixtureContexts.length} fixture(s) via Claude...`);
  const predictions = await generatePredictions(fixtureContexts);

  const fixtureByMatchId = new Map(fixtureContexts.map((f) => [f.matchId, f]));

  let updated = 0;
  for (const prediction of predictions) {
    const fixture = fixtureByMatchId.get(prediction.matchId);
    const { error: updateError } = await supabase
      .from("predictions")
      .update({
        markets: prediction.markets,
        confidence: prediction.confidence,
        summary: prediction.summary,
        h2h: fixture?.stats.headToHead ?? null,
      })
      .eq("match_id", prediction.matchId);

    if (updateError) {
      console.error(`Failed to update prediction for match_id ${prediction.matchId}:`, updateError.message);
      continue;
    }
    updated++;
  }

  console.log("\n=== Generate-predictions summary ===");
  console.log(`Pending fixtures: ${pending.length}`);
  console.log(`Predictions generated & updated: ${updated}`);
  console.log(`Skipped (H2H scrape failed): ${skippedFixtures.join(", ") || "none"}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
