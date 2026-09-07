import { SITE_URL } from "@/lib/site";

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

// Same mark as app/icon.svg, inlined so it renders identically in the
// Satori-based image pipeline without a separate asset fetch.
const LOGO_SVG = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 529 529"><rect width="529" height="529" rx="180" fill="#063B09" /><path d="M215.86 114.04C221.352 113.529 253.621 143.859 263.004 144.607C272.471 145.361 281.988 136.301 289.445 130.811C297.226 125.008 305.081 119.296 312.997 113.676C344.762 125.983 368.185 141.361 389.044 168.784C385.977 179.073 372.317 214.006 373.599 222.38C374.058 225.413 375.625 227.934 377.719 230.123C381.811 234.415 387.555 237.741 392.409 241.17C401.445 247.444 410.396 253.848 419.247 260.379C419.421 285.59 413.341 310.451 401.551 332.736C398.422 338.671 394.52 344.595 391.032 350.381C384.37 350.448 375.233 350.648 368.818 350.394C326.422 348.716 330.268 350.053 318.567 387.991C316.474 394.962 314.508 401.226 311.782 407.978C282.889 418.184 247.021 417.285 217.887 408.206C213.834 397.112 205.207 361.432 199.071 355.003C196.893 352.722 194.038 351.441 190.982 350.83C184.919 349.619 177.965 350.273 171.768 350.29L138.01 350.409C134.629 344.427 130.94 338.988 127.653 332.757C115.236 309.226 110.237 287.164 109.75 260.805C118.769 252.982 150.489 233.982 154.38 225.796C155.6 223.231 155.858 220.354 155.511 217.561C154.755 211.443 151.989 205.158 150.052 199.306C146.777 189.197 143.401 179.121 139.925 169.08C160.499 142.256 184 125.191 215.86 114.04Z" fill="#EEFF01" /><path d="M262.948 190.213C270.316 190.152 276.636 195.368 282.369 199.615C297.031 210.473 311.799 221.071 326.321 232.116C339.153 241.876 333.112 249.752 329.568 262.599C323.819 280.032 318.433 298.255 312.258 315.61C307.696 328.435 293.857 325.376 283.147 325.668C277.829 325.813 272.202 325.622 266.822 325.596C259.046 325.556 226.789 327.114 222.041 323.143C214.036 316.448 201.641 265.457 196.675 253.846C193.333 245.358 194.979 236.669 203.069 231.815C217.356 223.248 248.908 193.994 262.948 190.213Z" fill="#063B09" /></svg>`,
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
