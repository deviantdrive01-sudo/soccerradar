import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AdminTemplateSettingsForm } from "@/components/admin-template-settings-form";
import { TEMPLATE_IDS, TEMPLATE_LABELS, LOCAL_FALLBACK_URL, FALLBACK_SETTINGS } from "@/lib/template-settings";

export default async function AdminTemplatesPage() {
  const supabase = createAdminSupabaseClient();
  const { data: rows } = await supabase.from("template_settings").select("*");
  const byId = new Map((rows ?? []).map((row) => [row.id, row]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Style the three downloadable-image templates (Match Day, League Matches, Outcomes) — background photo,
          accent color, and wordmark text. Changes apply to every image generated after saving.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {TEMPLATE_IDS.map((id) => {
          const row = byId.get(id);
          const fallback = FALLBACK_SETTINGS[id];
          return (
            <div key={id} className="space-y-3 rounded-md border border-border/60 p-4">
              <p className="text-sm font-medium">{TEMPLATE_LABELS[id]}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded asset, no next/image benefit */}
              <img
                src={row?.background_url || LOCAL_FALLBACK_URL[id]}
                alt={`Current ${TEMPLATE_LABELS[id]} background`}
                className="max-h-64 w-full rounded-lg border border-border/60 object-cover"
              />
              <AdminTemplateSettingsForm
                id={id}
                accentColor={row?.accent_color ?? fallback.accentColor}
                wordmarkText={row?.wordmark_text ?? fallback.wordmarkText}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
