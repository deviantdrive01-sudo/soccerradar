import fs from "node:fs";
import path from "node:path";
import { SITE_URL } from "@/lib/site";

export const SHARE_IMAGE_SIZE = { width: 1244, height: 1550 };

// Satori (the ImageResponse renderer) needs font data handed to it directly —
// it can't read the app's own @font-face woff2 files or system fonts, and
// only accepts ttf/otf (not woff2). This is the same General Sans used
// across the site's UI, pinned to two static instances: once Satori has
// *any* custom "General Sans" registered, unmatched requests fall back to
// whichever instance is loaded rather than its own built-in default — so a
// normal-style instance is required too, not just the italic headline one.
const BOLD_FONT = fs.readFileSync(path.join(process.cwd(), "lib/fonts/GeneralSans-Bold.ttf"));
const BOLD_ITALIC_FONT = fs.readFileSync(path.join(process.cwd(), "lib/fonts/GeneralSans-BoldItalic.ttf"));

export const SHARE_IMAGE_OPTIONS = {
  ...SHARE_IMAGE_SIZE,
  fonts: [
    { name: "General Sans", data: BOLD_FONT, weight: 700 as const, style: "normal" as const },
    { name: "General Sans", data: BOLD_ITALIC_FONT, weight: 700 as const, style: "italic" as const },
  ],
};

// Same mark as app/icon.svg, recolored for the dark background (yellow
// badge / black mark, matching the "dark chrome" yellow used elsewhere —
// e.g. components/all-leagues-badge.tsx's dark variant).
const LOGO_ICON_SVG = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 529 529"><rect width="529" height="529" rx="150" fill="#F1FF3B" /><path d="M215.86 114.04C221.352 113.529 253.621 143.859 263.004 144.607C272.471 145.361 281.988 136.301 289.445 130.811C297.226 125.008 305.081 119.296 312.997 113.676C344.762 125.983 368.185 141.361 389.044 168.784C385.977 179.073 372.317 214.006 373.599 222.38C374.058 225.413 375.625 227.934 377.719 230.123C381.811 234.415 387.555 237.741 392.409 241.17C401.445 247.444 410.396 253.848 419.247 260.379C419.421 285.59 413.341 310.451 401.551 332.736C398.422 338.671 394.52 344.595 391.032 350.381C384.37 350.448 375.233 350.648 368.818 350.394C326.422 348.716 330.268 350.053 318.567 387.991C316.474 394.962 314.509 401.226 311.782 407.978C282.889 418.184 247.021 417.285 217.887 408.206C213.834 397.112 205.207 361.432 199.071 355.003C196.893 352.722 194.038 351.441 190.982 350.83C184.919 349.619 177.965 350.273 171.768 350.29L138.01 350.409C134.629 344.427 130.94 338.988 127.653 332.757C115.236 309.226 110.237 287.164 109.75 260.805C118.769 252.982 150.489 233.982 154.38 225.796C155.6 223.231 155.858 220.354 155.511 217.561C154.755 211.443 151.989 205.158 150.052 199.306C146.777 189.197 143.401 179.121 139.925 169.08C160.499 142.256 184 125.191 215.86 114.04Z" fill="black" /><path d="M262.948 190.213C270.316 190.152 276.636 195.368 282.369 199.615C297.031 210.473 311.799 221.071 326.321 232.116C339.153 241.876 333.112 249.752 329.568 262.599C323.819 280.032 318.433 298.255 312.258 315.61C307.696 328.435 293.857 325.376 283.147 325.668C277.829 325.813 272.202 325.622 266.822 325.596C259.046 325.556 226.789 327.114 222.041 323.143C214.036 316.448 201.641 265.457 196.675 253.846C193.333 245.358 194.979 236.669 203.069 231.815C217.356 223.248 248.908 193.994 262.948 190.213Z" fill="#F1FF3B" /></svg>`,
).toString("base64")}`;

// The stadium-and-ball photo backdrop, read from disk once per serverless
// instance and inlined as a data URI — avoids the app self-fetching its own
// public/ asset over HTTP during image generation (a known source of
// flakiness for OG image routes on some hosts).
const BACKGROUND_PNG = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "share-background.png"))
  .toString("base64")}`;

const YELLOW = "#F1FF3B";

export interface ShareImageItem {
  home: string;
  away: string;
  detail: string; // e.g. "Allsvenskan · Win Either Half: Home" or "Serie A · Home Win"
}

// Tuned by hand against the actual 1550px canvas — header + title block +
// this many item rows + footer must always fit without overflowing, since
// Satori/ImageResponse doesn't shrink or scroll content that runs long.
const MAX_VISIBLE = 4;

function initial(label: string): string {
  return (label.trim()[0] ?? "?").toUpperCase();
}

/**
 * Fetches an avatar image and inlines it as a data URI. Satori's own
 * built-in remote-image fetching (passing the URL straight through to
 * `<img src>`) is unreliable for this in practice — resolving it ourselves
 * first, the same way the background/logo are already inlined, sidesteps
 * whatever's going wrong there. Returns null on any failure so the caller
 * can fall back to the initials avatar rather than a broken image.
 */
export async function resolveAvatarDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Shared template for booking/collection/top-picks share-preview images (X,
 * Telegram, link unfurling, and the "Download image" button).
 */
export function ShareImageTemplate({
  title,
  ownerLabel,
  avatarUrl,
  items,
}: {
  title: string;
  ownerLabel: string;
  avatarUrl?: string | null;
  items: ShareImageItem[];
}) {
  const visible = items.slice(0, MAX_VISIBLE);
  const remaining = items.length - visible.length;
  const dateLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundImage: `url(${BACKGROUND_PNG})`,
        backgroundSize: "cover",
        fontFamily: "General Sans",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", padding: "56px 64px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendering, not a browser <img> */}
            <img src={LOGO_ICON_SVG} width={64} height={64} alt="" />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#ffffff", letterSpacing: -0.5 }}>SOCCE</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#ffffff", letterSpacing: -0.5 }}>RADAR</span>
            </div>
          </div>
          <span style={{ fontSize: 30, fontWeight: 600, color: "#ffffff" }}>{dateLabel}</span>
        </div>

        <span
          style={{
            fontFamily: "General Sans",
            fontSize: 88,
            fontWeight: 700,
            fontStyle: "italic",
            color: "#ffffff",
            lineHeight: 1,
            letterSpacing: -2,
            textTransform: "uppercase",
            marginTop: 44,
          }}
        >
          {title}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 32 }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} width={64} height={64} style={{ borderRadius: "50%", objectFit: "cover" }} alt="" />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: YELLOW,
                fontSize: 26,
                fontWeight: 800,
                color: "#0a0a0a",
              }}
            >
              {initial(ownerLabel)}
            </div>
          )}
          <span style={{ fontSize: 32, fontWeight: 700, color: "#ffffff" }}>by {ownerLabel}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 40 }}>
          {visible.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#f8fafc",
                borderRadius: 20,
                padding: "22px 28px",
              }}
            >
              <span style={{ fontSize: 27, fontWeight: 700, color: "#0f172a" }}>
                {item.home} vs {item.away}
              </span>
              <span style={{ fontSize: 20, color: "#64748b", marginTop: 4 }}>{item.detail}</span>
            </div>
          ))}
        </div>

        {remaining > 0 && (
          <span style={{ fontSize: 26, fontWeight: 700, color: "#ffffff", marginTop: 24 }}>
            +{remaining} more pick{remaining === 1 ? "" : "s"} ›
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: YELLOW,
          padding: "32px 64px",
        }}
      >
        <span style={{ fontSize: 30, fontWeight: 800, color: "#0a0a0a" }}>@socceradar</span>
        <span style={{ fontSize: 30, fontWeight: 800, color: "#0a0a0a" }}>{SITE_URL.replace("https://", "")}</span>
      </div>
    </div>
  );
}
