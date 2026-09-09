import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createSupabaseReadClient } from "@/lib/supabase/client";

export type TemplateId = "match_day" | "league_matches" | "best_picks";

export interface TemplateSettings {
  backgroundUrl: string;
  accentColor: string;
  wordmarkText: string;
}

/** Used only if the template_settings row is missing (e.g. before its first admin save) — keeps every route, and the admin page's own defaults, rendering something reasonable rather than crashing. */
export const FALLBACK_SETTINGS: Record<TemplateId, TemplateSettings> = {
  match_day: { backgroundUrl: "", accentColor: "#F1FF3B", wordmarkText: "Match Day" },
  league_matches: { backgroundUrl: "", accentColor: "#F1FF3B", wordmarkText: "Matchday" },
  best_picks: { backgroundUrl: "", accentColor: "#F1FF3B", wordmarkText: "Outcomes" },
};

/** Same images as readLocalFallbackBuffer, as the public URL /admin/templates previews before any custom background has been uploaded. */
export const LOCAL_FALLBACK_URL: Record<TemplateId, string> = {
  match_day: "/match-day-background.jpg",
  league_matches: "/league-matches-background.jpg",
  best_picks: "/best-picks-background.jpg",
};

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  match_day: "Match Day",
  league_matches: "League Matches",
  best_picks: "Outcomes (Best Picks)",
};

export const TEMPLATE_IDS: TemplateId[] = ["match_day", "league_matches", "best_picks"];

/**
 * The bundled background file for a template — read fresh each call so a
 * freshly-saved admin upload doesn't require a redeploy to seed from. Each
 * path is written out as a literal at its own call site (rather than indexed
 * out of a Record<TemplateId, string> by a runtime id) so Next's build-time
 * file tracer can scope the read to just that file — a dynamic path here
 * makes it trace (and ship) the entire project's public/ folder.
 */
export function readLocalFallbackBuffer(id: TemplateId): Buffer {
  switch (id) {
    case "match_day":
      return fs.readFileSync(path.join(process.cwd(), "public", "match-day-background.jpg"));
    case "league_matches":
      return fs.readFileSync(path.join(process.cwd(), "public", "league-matches-background.jpg"));
    case "best_picks":
      return fs.readFileSync(path.join(process.cwd(), "public", "best-picks-background.jpg"));
  }
}

/** Reads a template's current style config — background image URL, accent color, wordmark text — editable from /admin/templates. */
export async function getTemplateSettings(id: TemplateId): Promise<TemplateSettings> {
  const supabase = createSupabaseReadClient();
  const { data } = await supabase.from("template_settings").select("*").eq("id", id).maybeSingle();
  if (!data) return FALLBACK_SETTINGS[id];
  return { backgroundUrl: data.background_url, accentColor: data.accent_color, wordmarkText: data.wordmark_text };
}

/**
 * Fetches a template's background image and inlines it as a base64 data URI
 * — Satori's remote backgroundImage/<img src> fetching is unreliable, same
 * reasoning as crest/avatar resolution elsewhere in this codebase. Falls
 * back to the template's original bundled image (never a broken render) if
 * the Storage fetch fails or no URL is set yet.
 */
export async function resolveTemplateBackground(id: TemplateId, backgroundUrl: string): Promise<string> {
  if (backgroundUrl) {
    try {
      const res = await fetch(backgroundUrl);
      if (res.ok) {
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        const buffer = Buffer.from(await res.arrayBuffer());
        return `data:${contentType};base64,${buffer.toString("base64")}`;
      }
    } catch {
      // fall through to the local fallback below
    }
  }
  const buffer = readLocalFallbackBuffer(id);
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}
