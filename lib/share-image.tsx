import { SITE_URL } from "@/lib/site";

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

// Same mark as app/icon.svg, inlined so it renders identically in the
// Satori-based image pipeline without a separate asset fetch.
const LOGO_SVG = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#009c50" /><g transform="translate(22,22) scale(2.3333)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 13V2l8 4-8 4" /><path d="M20.561 10.222a9 9 0 1 1-12.55-5.29" /><path d="M8.002 9.997a5 5 0 1 0 8.9 2.02" /></g></svg>`,
).toString("base64")}`;

export interface ShareImageItem {
  home: string;
  away: string;
  detail: string; // e.g. "Allsvenskan · Win Either Half: Home" or "Serie A · Home Win"
}

// Tuned by hand against the actual 630px canvas — header + title block +
// this many item rows + footer must always fit without overflowing, since
// Satori/ImageResponse doesn't shrink or scroll content that runs long.
const MAX_VISIBLE = 4;

/**
 * Shared template for booking/collection share-preview images (X, Telegram,
 * link unfurling). First pass at the design — expected to evolve.
 */
export function ShareImageTemplate({
  title,
  ownerLabel,
  items,
}: {
  title: string;
  ownerLabel: string;
  items: ShareImageItem[];
}) {
  const visible = items.slice(0, MAX_VISIBLE);
  const remaining = items.length - visible.length;
  const dateLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        padding: "36px 56px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img> */}
          <img src={LOGO_SVG} width={40} height={40} alt="" />
          <span style={{ fontSize: 24, fontWeight: 700, color: "#0a0a0a" }}>SoccerRadar</span>
        </div>
        <span style={{ fontSize: 18, color: "#71717a" }}>{dateLabel}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
        <span style={{ fontSize: 38, fontWeight: 800, color: "#0a0a0a", lineHeight: 1.15 }}>{title}</span>
        <span style={{ fontSize: 19, color: "#71717a", marginTop: 3 }}>by {ownerLabel}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
        {visible.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              border: "1px solid #e4e4e7",
              borderRadius: 10,
              padding: "9px 18px",
            }}
          >
            <span style={{ fontSize: 21, fontWeight: 700, color: "#0a0a0a" }}>
              {item.home} vs {item.away}
            </span>
            <span style={{ fontSize: 15, color: "#71717a", marginTop: 2 }}>{item.detail}</span>
          </div>
        ))}
        {remaining > 0 && (
          <span style={{ fontSize: 17, fontWeight: 600, color: "#009c50" }}>+{remaining} more pick{remaining === 1 ? "" : "s"}</span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
          paddingTop: 16,
          borderTop: "1px solid #e4e4e7",
        }}
      >
        <span style={{ fontSize: 18, color: "#52525b" }}>@socceradar</span>
        <span style={{ fontSize: 18, color: "#52525b" }}>{SITE_URL.replace("https://", "")}</span>
      </div>
    </div>
  );
}
