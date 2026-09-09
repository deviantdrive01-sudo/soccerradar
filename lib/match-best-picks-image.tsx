import { SHARE_IMAGE_OPTIONS, LOGO_ICON_SVG } from "@/lib/share-image";
import type { MarketKey } from "@/lib/hydrate";

export const BEST_PICKS_IMAGE_WIDTH = 1200;

const HEADER_HEIGHT = 520; // crests + names + league/kickoff + gap before the card
const CARD_HEADER_HEIGHT = 96; // the "SOCCERADAR" branded row inside the card
const ROW_HEIGHT = 116; // title + subtitle, per pick
const CARD_VERTICAL_PADDING = 32;
const FOOTER_HEIGHT = 170; // "OUTCOMES" wordmark + bottom padding

/** Content-fitted canvas height for a given number of qualifying markets. */
export function bestPicksImageHeight(pickCount: number): number {
  return HEADER_HEIGHT + CARD_HEADER_HEIGHT + Math.max(pickCount, 1) * ROW_HEIGHT + CARD_VERTICAL_PADDING * 2 + FOOTER_HEIGHT;
}

export const BEST_PICKS_IMAGE_OPTIONS_FONTS = SHARE_IMAGE_OPTIONS.fonts;

/** Short plain-language category name for each market — the dimmer second line under each pick's bold title. */
export const MARKET_DESCRIPTIONS: Record<MarketKey, string> = {
  fullTimeDraw: "Full-Time Draw",
  fullTimeOutcome: "Full-Time Match Result",
  firstHalfOutcome: "First-Half Result",
  winEitherHalf: "Win Either Half",
  highestScoringHalf: "Highest Scoring Half",
  over1_5: "Total Match Goals Over 1.5",
  over2_5: "Total Match Goals Over 2.5",
  drawOrOver2_5: "Draw or Over 2.5 Goals",
  over7_5: "Total Match Corners Over 7.5",
  over8_5: "Total Match Corners Over 8.5",
  firstHalfOver3_5: "First-Half Corners Over 3.5",
  doubleChance: "Double Chance",
  homeCleanSheet: "Home Team Clean Sheet",
  awayCleanSheet: "Away Team Clean Sheet",
  homeCornersOver4_5: "Home Team Corners Over 4.5",
  awayCornersOver4_5: "Away Team Corners Over 4.5",
  homeGoalsOver1_5: "Home Team Goals Over 1.5",
  awayGoalsOver1_5: "Away Team Goals Over 1.5",
  bothTeamsToScore: "Both Teams to Score",
  x2AndOver1_5: "Draw/Away & Over 1.5 Goals",
};

function initial(label: string): string {
  return (label.trim()[0] ?? "?").toUpperCase();
}

function CrestBadge({ teamName, crestUrl }: { teamName: string; crestUrl: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 170,
        height: 170,
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        flexShrink: 0,
      }}
    >
      {crestUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img>
        <img src={crestUrl} width={124} height={124} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <span style={{ fontSize: 62, fontWeight: 800, color: "#0a0a0a" }}>{initial(teamName)}</span>
      )}
    </div>
  );
}

export interface BestPickRow {
  title: string;
  subtitle: string;
}

/** Downloadable "every market clearing the bar for this match" graphic — light header (crests, names, league, kickoff) over the top of a background photo that fades to a dark stadium shot by the bottom, a branded card with a timeline-style pick list, and a wordmark closing it out. Background/accent/wordmark come from the admin-editable template_settings row (see lib/template-settings.ts) rather than being hardcoded. */
export function MatchBestPicksImageTemplate({
  homeTeam,
  awayTeam,
  homeCrestUrl,
  awayCrestUrl,
  leagueLabel,
  kickoffLabel,
  picks,
  backgroundUrl,
  accentColor,
  wordmarkText,
}: {
  homeTeam: string;
  awayTeam: string;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  leagueLabel: string;
  kickoffLabel: string;
  picks: BestPickRow[];
  backgroundUrl: string;
  accentColor: string;
  wordmarkText: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: "cover",
        fontFamily: "General Sans",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 56px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 240 }}>
            <CrestBadge teamName={homeTeam} crestUrl={homeCrestUrl} />
            <span style={{ marginTop: 18, fontSize: 34, fontWeight: 600, color: "#0a0a0a", textAlign: "center" }}>{homeTeam}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img> */}
          <img src={LOGO_ICON_SVG} width={60} height={60} style={{ marginTop: 55 }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 240 }}>
            <CrestBadge teamName={awayTeam} crestUrl={awayCrestUrl} />
            <span style={{ marginTop: 18, fontSize: 34, fontWeight: 600, color: "#0a0a0a", textAlign: "center" }}>{awayTeam}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 32, gap: 8 }}>
          <span style={{ fontSize: 30, fontWeight: 500, color: "rgba(10,10,10,0.75)" }}>{leagueLabel}</span>
          <span style={{ fontSize: 36, fontWeight: 700, color: "#0a0a0a" }}>{kickoffLabel}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "36px 144px 0" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "rgba(10,10,10,0.92)",
            borderRadius: 28,
            padding: `${CARD_VERTICAL_PADDING}px 40px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: CARD_HEADER_HEIGHT - CARD_VERTICAL_PADDING }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.4)" }} />
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img> */}
            <img src={LOGO_ICON_SVG} width={30} height={30} alt="" />
            <span style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", letterSpacing: 1, textTransform: "uppercase" }}>
              SoccerRadar
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid rgba(255,255,255,0.14)", marginTop: 8, paddingTop: 8 }}>
            {picks.map((pick, index) => (
              <div key={`${pick.title}-${index}`} style={{ display: "flex", alignItems: "flex-start", height: ROW_HEIGHT }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, height: "100%" }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: `2px solid ${accentColor}`,
                      backgroundColor: "rgba(10,10,10,0.92)",
                      marginTop: 8,
                      flexShrink: 0,
                    }}
                  />
                  {index < picks.length - 1 && <span style={{ width: 2, flex: 1, backgroundColor: "rgba(255,255,255,0.18)", marginTop: 6 }} />}
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginLeft: 20, gap: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#ffffff" }}>{pick.title}</span>
                  <span style={{ fontSize: 21, fontWeight: 400, color: "rgba(255,255,255,0.55)" }}>{pick.subtitle}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "flex-end", padding: "0 32px 32px" }}>
        <span
          style={{
            fontFamily: "General Sans",
            fontSize: 176,
            fontWeight: 700,
            fontStyle: "italic",
            color: accentColor,
            lineHeight: 1,
            letterSpacing: -6,
            textTransform: "uppercase",
          }}
        >
          {wordmarkText}
        </span>
      </div>
    </div>
  );
}
