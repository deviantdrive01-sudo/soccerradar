/**
 * One-time backfill — attaches head-to-head history to predictions that
 * were already generated before scripts/generate-predictions.ts started
 * persisting it (see supabase/migrations/12_h2h_meetings.sql). Every new
 * prediction from that pipeline already includes h2h from day one; this
 * just fills in the existing backlog of upcoming, unsettled predictions.
 *
 * Unlike generate-predictions.ts, this never touches markets/confidence/
 * summary — it only scrapes and writes the h2h column, so the prediction
 * itself (and anything already referencing it, e.g. a booking) is
 * untouched. Not scheduled — run manually once the backlog is cleared.
 */
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const MAX_H2H_MEETINGS = 3;
const MAX_PER_RUN = 150; // generous — this only needs to clear the backlog once

interface H2hRow {
  date: string;
  competition: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  mid: string;
}

async function scrapeH2hSections(page: Page, matchId: string): Promise<H2hRow[]> {
  const url = `https://www.flashscore.com/match/football/${matchId}/#/h2h/overall`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  try {
    await page.getByText("H2H", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch {
    // No H2H tab available for this fixture — stays empty.
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

  return sections
    .find((s) => s.heading === "Head-to-head matches")
    ?.rows.filter((r) => r.mid && /^\d+$/.test(r.homeScore) && /^\d+$/.test(r.awayScore))
    .slice(0, MAX_H2H_MEETINGS)
    .map((r) => ({
      date: r.date,
      competition: r.competition,
      home: r.home,
      away: r.away,
      homeScore: Number(r.homeScore),
      awayScore: Number(r.awayScore),
      mid: r.mid,
    })) ?? [];
}

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

async function main() {
  const now = new Date();
  // This run: today through the upcoming Thursday (inclusive), per explicit
  // request — not the full upcoming backlog.
  const daysUntilThursday = (4 - now.getUTCDay() + 7) % 7;
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilThursday, 23, 59, 59));

  const { data: pending, error } = await supabase
    .from("predictions")
    .select("id, match_id, home_team, away_team")
    .not("markets", "is", null)
    .is("h2h", null)
    .is("actual_result", null)
    .gte("match_date", now.toISOString())
    .lte("match_date", windowEnd.toISOString())
    .order("match_date", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("Failed to load backlog:", error.message);
    process.exit(1);
  }
  if (!pending || pending.length === 0) {
    console.log("No predictions need H2H backfill.");
    return;
  }

  console.log(`Backfilling H2H for ${pending.length} prediction(s)...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: USER_AGENT });

  let updated = 0;
  const skipped: string[] = [];

  for (const row of pending) {
    const label = `${row.home_team} vs ${row.away_team}`;
    try {
      const meetings = await scrapeH2hSections(page, row.match_id);
      const withCorners = [];
      for (const meeting of meetings) {
        const corners = await extractCorners(page, meeting.mid);
        withCorners.push({ ...meeting, corners });
      }

      const { error: updateError } = await supabase
        .from("predictions")
        .update({ h2h: withCorners })
        .eq("id", row.id);

      if (updateError) {
        console.error(`Failed to update ${label}:`, updateError.message);
        skipped.push(label);
        continue;
      }
      updated++;
      console.log(`[${updated}/${pending.length}] ${label} — ${withCorners.length} meeting(s)`);
    } catch (err) {
      console.warn(`Skipping ${label} — scrape failed:`, err instanceof Error ? err.message : err);
      skipped.push(label);
    }
  }

  await browser.close();

  console.log("\n=== Backfill-h2h summary ===");
  console.log(`Updated: ${updated}/${pending.length}`);
  console.log(`Skipped: ${skipped.join(", ") || "none"}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
