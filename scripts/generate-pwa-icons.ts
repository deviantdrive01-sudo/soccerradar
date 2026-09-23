import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/**
 * One-off generator for the PWA manifest's icon PNGs (192/512/maskable),
 * run via `npx tsx scripts/generate-pwa-icons.ts` whenever the source mark
 * changes — output PNGs are committed to public/icons/, not regenerated at
 * build time. (Favicon and apple-touch-icon are already covered by Next's
 * own file-convention icons, `app/icon.svg` and `app/apple-icon.png` — this
 * script only fills the manifest-icon gap those don't cover, and matches
 * their existing dark-green brand color for consistency.)
 *
 * Source is the emblem square embedded in public/logo-light.svg (viewBox
 * "0 0 1444 529" — the brand mark is a 529x529 rounded square at the left,
 * the rest is the wordmark). Re-pointing the root <svg>'s viewBox/width/
 * height at "0 0 529 529" crops to just that square without touching path
 * data, since the wordmark paths all sit at x > 600.
 */
const BRAND_BG = "#063B09";
const SIZE = 529;

function squareSvg(): Buffer {
  const source = readFileSync(join(process.cwd(), "public/logo-light.svg"), "utf8");
  const cropped = source
    .replace(/width="1444"/, `width="${SIZE}"`)
    .replace(/viewBox="0 0 1444 529"/, `viewBox="0 0 ${SIZE} ${SIZE}"`);
  return Buffer.from(cropped);
}

async function main() {
  const outDir = join(process.cwd(), "public/icons");
  const svg = squareSvg();

  // Standard icons (purpose "any") — transparent outside the emblem's own
  // rounded-rect corners; OS/browser chrome applies its own icon shape.
  for (const size of [192, 512]) {
    const png = await sharp(svg).resize(size, size).png().toBuffer();
    writeFileSync(join(outDir, `icon-${size}.png`), png);
  }

  // Maskable icon: content must sit inside a safe-zone circle so Android's
  // own shape mask never clips it. Composite the emblem, scaled down, onto
  // a full-bleed canvas in the same brand color — the seam is invisible
  // because both layers share BRAND_BG.
  const emblem = await sharp(svg).resize(410, 410).png().toBuffer();
  const maskable = await sharp({
    create: { width: 512, height: 512, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: emblem, gravity: "center" }])
    .png()
    .toBuffer();
  writeFileSync(join(outDir, "icon-512-maskable.png"), maskable);

  console.log("Generated icon-192.png, icon-512.png, icon-512-maskable.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
