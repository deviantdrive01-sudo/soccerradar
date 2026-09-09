"use client";

import { useActionState } from "react";
import {
  saveMatchDayTemplate,
  saveLeagueMatchesTemplate,
  saveBestPicksTemplate,
  type SaveTemplateState,
} from "@/app/admin/(authed)/templates/actions";
import type { TemplateId } from "@/lib/template-settings";

const initialState: SaveTemplateState = {};

const ACTIONS: Record<TemplateId, typeof saveMatchDayTemplate> = {
  match_day: saveMatchDayTemplate,
  league_matches: saveLeagueMatchesTemplate,
  best_picks: saveBestPicksTemplate,
};

export function AdminTemplateSettingsForm({
  id,
  accentColor,
  wordmarkText,
}: {
  id: TemplateId;
  accentColor: string;
  wordmarkText: string;
}) {
  const [state, formAction, pending] = useActionState(ACTIONS[id], initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">Background image</label>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          className="w-full text-sm text-muted-foreground file:mr-3 file:h-8 file:rounded-md file:border file:border-border/60 file:bg-background file:px-3 file:text-sm file:font-medium hover:file:bg-muted/60"
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground">Accent color</label>
        <input
          type="color"
          name="accentColor"
          defaultValue={accentColor}
          className="h-8 w-12 rounded border border-border/60 bg-transparent p-0.5"
        />
        <span className="text-xs text-muted-foreground">{accentColor}</span>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">Wordmark text</label>
        <input
          type="text"
          name="wordmarkText"
          defaultValue={wordmarkText}
          required
          className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md border border-border/60 px-3 text-xs font-medium hover:bg-muted/60 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-primary">Saved — the download image now uses this.</p>}
    </form>
  );
}
