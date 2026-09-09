import { SHARE_IMAGE_OPTIONS, LOGO_ICON_SVG } from "@/lib/share-image";

export const LEAGUE_MATCHES_IMAGE_WIDTH = 1200;
export const LEAGUE_MATCHES_MAX_VISIBLE = 8;

const HEADER_HEIGHT = 460; // top padding + MATCHDAY wordmark + league + date/time + gap before the card
const ROW_HEIGHT = 132;
const CARD_VERTICAL_PADDING = 24; // top+bottom padding inside the card, per side
const FOOTER_HEIGHT = 180; // "+N more" line (when present) + logo + bottom padding

/** Total canvas height for a given number of visible rows — content-fitted rather than one fixed size, so a 2-match league doesn't leave a huge empty card. */
export function leagueMatchesImageHeight(rowCount: number): number {
  return HEADER_HEIGHT + rowCount * ROW_HEIGHT + CARD_VERTICAL_PADDING * 2 + FOOTER_HEIGHT;
}

export const LEAGUE_MATCHES_IMAGE_OPTIONS_FONTS = SHARE_IMAGE_OPTIONS.fonts;

function initial(label: string): string {
  return (label.trim()[0] ?? "?").toUpperCase();
}

function SmallCrest({ teamName, crestUrl }: { teamName: string; crestUrl: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 76,
        height: 76,
        borderRadius: "50%",
        backgroundColor: "#ffffff",
        flexShrink: 0,
      }}
    >
      {crestUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img>
        <img src={crestUrl} width={54} height={54} style={{ objectFit: "contain" }} alt="" />
      ) : (
        <span style={{ fontSize: 28, fontWeight: 800, color: "#0a0a0a" }}>{initial(teamName)}</span>
      )}
    </div>
  );
}

export interface LeagueMatchesImageMatch {
  homeTeam: string;
  awayTeam: string;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
}

/** Downloadable "matchday" fixture-list graphic for one league — every visible match as a row inside one card, distinct from MatchDayImageTemplate's single-fixture layout. Background/accent/wordmark come from the admin-editable template_settings row (see lib/template-settings.ts) rather than being hardcoded. */
export function LeagueMatchesImageTemplate({
  leagueLabel,
  dateLabel,
  timeLabel,
  matches,
  moreCount,
  backgroundUrl,
  accentColor,
  wordmarkText,
}: {
  leagueLabel: string;
  dateLabel: string;
  /** Null when the group's kickoffs don't all share one time — the header then shows only the date. */
  timeLabel: string | null;
  matches: LeagueMatchesImageMatch[];
  moreCount: number;
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 56px 0" }}>
        <span
          style={{
            fontFamily: "General Sans",
            fontSize: 140,
            fontWeight: 700,
            fontStyle: "italic",
            color: accentColor,
            lineHeight: 1,
            letterSpacing: -4,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          {wordmarkText}
        </span>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 24, gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 600, color: "#ffffff" }}>{leagueLabel}</span>
          <span style={{ fontSize: 36, fontWeight: 800, color: "#ffffff" }}>{timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "40px 56px 0" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "rgba(10,10,10,0.82)",
            borderRadius: 28,
            padding: `${CARD_VERTICAL_PADDING}px 40px`,
          }}
        >
          {matches.map((match, index) => (
            <div
              key={`${match.homeTeam}-${match.awayTeam}`}
              style={{
                display: "flex",
                alignItems: "center",
                height: ROW_HEIGHT,
                borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", paddingRight: 20 }}>
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: "#ffffff",
                    textTransform: "uppercase",
                    textAlign: "right",
                  }}
                >
                  {match.homeTeam}
                </span>
              </div>
              <SmallCrest teamName={match.homeTeam} crestUrl={match.homeCrestUrl} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  width: 70,
                  flexShrink: 0,
                  marginLeft: 16,
                  marginRight: 16,
                }}
              >
                <span style={{ fontSize: 24, fontWeight: 800, color: accentColor }}>VS</span>
              </div>
              <SmallCrest teamName={match.awayTeam} crestUrl={match.awayCrestUrl} />
              <div style={{ display: "flex", flex: 1, justifyContent: "flex-start", paddingLeft: 20 }}>
                <span
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: "#ffffff",
                    textTransform: "uppercase",
                  }}
                >
                  {match.awayTeam}
                </span>
              </div>
            </div>
          ))}
        </div>

        {moreCount > 0 && (
          <span style={{ marginTop: 20, textAlign: "center", fontSize: 26, fontWeight: 600, color: "#ffffff" }}>+{moreCount} more</span>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "flex-end", padding: "0 0 48px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img> */}
        <img src={LOGO_ICON_SVG} width={72} height={72} alt="" />
      </div>
    </div>
  );
}
