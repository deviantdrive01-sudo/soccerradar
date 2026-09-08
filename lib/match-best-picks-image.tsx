import fs from "node:fs";
import path from "node:path";
import { SHARE_IMAGE_OPTIONS, LOGO_ICON_SVG, YELLOW } from "@/lib/share-image";

export const BEST_PICKS_IMAGE_WIDTH = 1200;

const HEADER_HEIGHT = 560; // crests + names + league/kickoff + wordmark + gap before the card
const ROW_HEIGHT = 96;
const CARD_VERTICAL_PADDING = 28; // top+bottom padding inside the card, per side
const FOOTER_HEIGHT = 150; // logo + bottom padding

/** Content-fitted canvas height for a given number of qualifying markets — same approach as leagueMatchesImageHeight. */
export function bestPicksImageHeight(pickCount: number): number {
  return HEADER_HEIGHT + Math.max(pickCount, 1) * ROW_HEIGHT + CARD_VERTICAL_PADDING * 2 + FOOTER_HEIGHT;
}

export const BEST_PICKS_IMAGE_OPTIONS_FONTS = SHARE_IMAGE_OPTIONS.fonts;

const BACKGROUND_JPEG = `data:image/jpeg;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "match-day-background.jpg"))
  .toString("base64")}`;

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
        width: 150,
        height: 150,
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        flexShrink: 0,
      }}
    >
      {crestUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img>
        <img src={crestUrl} width={110} height={110} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <span style={{ fontSize: 54, fontWeight: 800, color: "#0a0a0a" }}>{initial(teamName)}</span>
      )}
    </div>
  );
}

export interface BestPickRow {
  label: string;
  value: string;
}

/** Downloadable "every market clearing the bar for this match" graphic — distinct from MatchDayImageTemplate (single announcement) and LeagueMatchesImageTemplate (one row per match, this is one row per market for a single match). */
export function MatchBestPicksImageTemplate({
  homeTeam,
  awayTeam,
  homeCrestUrl,
  awayCrestUrl,
  leagueLabel,
  kickoffLabel,
  picks,
}: {
  homeTeam: string;
  awayTeam: string;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  leagueLabel: string;
  kickoffLabel: string;
  picks: BestPickRow[];
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundImage: `url(${BACKGROUND_JPEG})`,
        backgroundSize: "cover",
        fontFamily: "General Sans",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "72px 56px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 220 }}>
            <CrestBadge teamName={homeTeam} crestUrl={homeCrestUrl} />
            <span style={{ marginTop: 16, fontSize: 26, fontWeight: 700, color: "#ffffff", textAlign: "center", textTransform: "uppercase" }}>
              {homeTeam}
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img> */}
          <img src={LOGO_ICON_SVG} width={64} height={64} style={{ marginTop: 43 }} alt="" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 220 }}>
            <CrestBadge teamName={awayTeam} crestUrl={awayCrestUrl} />
            <span style={{ marginTop: 16, fontSize: 26, fontWeight: 700, color: "#ffffff", textAlign: "center", textTransform: "uppercase" }}>
              {awayTeam}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 24, gap: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 600, color: "#ffffff" }}>{leagueLabel}</span>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#ffffff" }}>{kickoffLabel}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <span
            style={{
              fontFamily: "General Sans",
              fontSize: 84,
              fontWeight: 700,
              fontStyle: "italic",
              color: YELLOW,
              lineHeight: 1,
              letterSpacing: -2,
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Best Picks
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "32px 56px 0" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "rgba(10,10,10,0.82)",
            borderRadius: 28,
            padding: `${CARD_VERTICAL_PADDING}px 44px`,
          }}
        >
          {picks.map((pick, index) => (
            <div
              key={pick.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: ROW_HEIGHT,
                borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <span style={{ fontSize: 30, fontWeight: 600, color: "#ffffff" }}>{pick.label}</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: YELLOW }}>{pick.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "flex-end", padding: "0 0 40px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img> */}
        <img src={LOGO_ICON_SVG} width={64} height={64} alt="" />
      </div>
    </div>
  );
}
