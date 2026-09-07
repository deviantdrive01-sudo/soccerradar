import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  hydratePrediction,
  isCompactPrediction,
  type HydratedPrediction,
} from "@/lib/hydrate";

/**
 * Recent-form / head-to-head stats bundle passed to Claude as analysis
 * context. Fields are `unknown` because the shape depends on the source
 * feeding it — currently either lib/api-football.ts (basic H2H fixture
 * results + last-5 team fixtures, no corner data) or the Flashscore-based
 * scripts/update-predictions.ts pipeline (same idea, but headToHead entries
 * include real per-match corner counts scraped from each h2h fixture's own
 * Stats tab).
 */
export interface FixtureStatsContext {
  headToHead: unknown;
  homeTeamForm: unknown;
  awayTeamForm: unknown;
}

/**
 * Token-optimized prediction service.
 *
 * Two cost levers, per project spec:
 *  1. Prompt caching — the system instructions (rules + output schema) are
 *     identical on every call, so they're marked `cache_control: ephemeral`
 *     and reused across every batch in a run.
 *  2. Compact output — Claude replies with single-letter JSON keys instead
 *     of prose-labeled fields, cutting completion tokens. `lib/hydrate.ts`
 *     expands that shorthand into UI/DB-ready labels afterward.
 */

const DEFAULT_MODEL = "claude-sonnet-5";
const BATCH_SIZE = 8; // fixtures per Claude call — keeps prompts small & cacheable

export interface FixtureContext {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  kickoff: string; // ISO date
  stats: FixtureStatsContext;
}

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

Output strictly valid JSON: an array of objects with exactly those keys, no additional keys, no trailing commentary.`;

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Strips markdown code fences if the model wraps the JSON despite instructions. */
function extractJsonArray(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in model response");
  }
  return candidate.slice(start, end + 1);
}

function parseCompactResponse(raw: string): HydratedPrediction[] {
  const json = extractJsonArray(raw);
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("Model response JSON is not an array");
  }
  return parsed.filter(isCompactPrediction).map(hydratePrediction);
}

async function predictBatch(
  client: Anthropic,
  batch: FixtureContext[],
): Promise<HydratedPrediction[]> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const userPayload = batch.map((fixture) => ({
    id: fixture.matchId,
    league: fixture.leagueName,
    kickoff: fixture.kickoff,
    home: fixture.homeTeam,
    away: fixture.awayTeam,
    stats: fixture.stats,
  }));

  const response = await client.messages.create({
    model,
    // Bumped from 400/fixture: adding per-market confidence ("mc", 10 extra
    // numbers) and the clean-sheet market meaningfully grew the per-fixture
    // JSON output.
    max_tokens: 600 * batch.length,
    // This model defaults to adaptive extended thinking, which can consume
    // the entire max_tokens budget on internal reasoning and leave nothing
    // for the actual JSON output (confirmed in practice: stop_reason
    // "max_tokens" with a single "thinking" content block and no text block
    // at all). The task is a compact, deterministic classification with the
    // methodology already spelled out in the system prompt — thinking adds
    // cost and failure risk here, not quality.
    thinking: { type: "disabled" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: JSON.stringify(userPayload),
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error(
      "Anthropic response contained no text block. stop_reason:",
      response.stop_reason,
      "content block types:",
      response.content.map((b) => b.type),
      "usage:",
      response.usage,
    );
    throw new Error("Anthropic response contained no text block");
  }

  return parseCompactResponse(textBlock.text);
}

/**
 * Generates predictions for a set of fixtures, batching requests to keep
 * prompts small while reusing the cached system prompt across batches.
 * Batches run sequentially so a single API-Football/Claude rate limit
 * doesn't cause a burst of failures.
 */
export async function generatePredictions(
  fixtures: FixtureContext[],
): Promise<HydratedPrediction[]> {
  if (fixtures.length === 0) return [];

  const client = getAnthropicClient();
  const results: HydratedPrediction[] = [];

  for (const batch of chunk(fixtures, BATCH_SIZE)) {
    const batchResults = await predictBatch(client, batch);
    results.push(...batchResults);
  }

  return results;
}
