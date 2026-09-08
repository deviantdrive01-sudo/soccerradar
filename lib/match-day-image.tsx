import fs from "node:fs";
import path from "node:path";
import { SHARE_IMAGE_OPTIONS, LOGO_ICON_SVG, YELLOW } from "@/lib/share-image";

export const MATCH_DAY_IMAGE_SIZE = { width: 1400, height: 1400 };
export const MATCH_DAY_IMAGE_OPTIONS = { ...MATCH_DAY_IMAGE_SIZE, fonts: SHARE_IMAGE_OPTIONS.fonts };

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
        width: 200,
        height: 200,
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        flexShrink: 0,
      }}
    >
      {crestUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img>
        <img src={crestUrl} width={150} height={150} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <span style={{ fontSize: 72, fontWeight: 800, color: "#0a0a0a" }}>{initial(teamName)}</span>
      )}
    </div>
  );
}

/** Downloadable "match day" announcement graphic for a single fixture — distinct from ShareImageTemplate's list-of-matches layout. */
export function MatchDayImageTemplate({
  homeTeam,
  awayTeam,
  homeCrestUrl,
  awayCrestUrl,
  leagueLabel,
  kickoffLabel,
}: {
  homeTeam: string;
  awayTeam: string;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  leagueLabel: string;
  kickoffLabel: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundImage: `url(${BACKGROUND_JPEG})`,
        backgroundSize: "cover",
        fontFamily: "General Sans",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 64px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <CrestBadge teamName={homeTeam} crestUrl={homeCrestUrl} />
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img> */}
          <img src={LOGO_ICON_SVG} width={72} height={72} alt="" />
          <CrestBadge teamName={awayTeam} crestUrl={awayCrestUrl} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 56, gap: 8 }}>
          <span style={{ fontSize: 34, fontWeight: 500, color: "#0a0a0a" }}>{leagueLabel}</span>
          <span style={{ fontSize: 40, fontWeight: 800, color: "#0a0a0a" }}>{kickoffLabel}</span>
        </div>
      </div>

      <div style={{ display: "flex", padding: "0 48px 56px" }}>
        <span
          style={{
            fontFamily: "General Sans",
            fontSize: 130,
            fontWeight: 700,
            fontStyle: "italic",
            color: YELLOW,
            lineHeight: 1,
            letterSpacing: -3,
            textTransform: "uppercase",
          }}
        >
          Match Day
        </span>
      </div>
    </div>
  );
}
