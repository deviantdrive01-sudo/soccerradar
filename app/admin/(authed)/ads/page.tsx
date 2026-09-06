import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { updateAdSettings } from "./actions";
import { AdminAdUploadForm } from "@/components/admin-ad-upload-form";

const FIELD = "h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Impure by nature (reads the clock) — kept out of the component body so it isn't flagged as a render-purity violation. */
function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function AdminAdsPage() {
  const supabase = createAdminSupabaseClient();

  const thirtyDaysAgo = thirtyDaysAgoIso();

  const [{ data: settings, error: settingsError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("ad_settings").select("*").eq("id", 1).single(),
    supabase.from("ad_events").select("event_type, created_at").gte("created_at", thirtyDaysAgo),
  ]);

  if (settingsError || !settings) {
    return <p className="text-sm text-destructive">Failed to load ad settings: {settingsError?.message}</p>;
  }

  const byDay = new Map<string, { impressions: number; clicks: number }>();
  for (const event of events ?? []) {
    const key = dayKey(event.created_at);
    const entry = byDay.get(key) ?? { impressions: 0, clicks: 0 };
    if (event.event_type === "impression") entry.impressions += 1;
    else entry.clicks += 1;
    byDay.set(key, entry);
  }
  const days = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const totalImpressions = days.reduce((sum, [, v]) => sum + v.impressions, 0);
  const totalClicks = days.reduce((sum, [, v]) => sum + v.clicks, 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "–";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ads</h1>
        <p className="text-sm text-muted-foreground">
          Controls how often the house ad shows vs. Google AdSense, and what the house ad links to.
        </p>
      </div>

      <form action={updateAdSettings} className="max-w-md space-y-4 rounded-md border border-border/60 p-4">
        <div className="space-y-1.5">
          <label htmlFor="house_weight" className="text-sm font-medium">
            House ad weight (0–100%)
          </label>
          <input
            id="house_weight"
            name="house_weight"
            type="number"
            min={0}
            max={100}
            defaultValue={settings.house_weight}
            className={FIELD}
          />
          <p className="text-xs text-muted-foreground">
            Chance a given ad slot shows the house ad instead of Google. Ignored (always house) if Google is
            disabled below.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="google_enabled" defaultChecked={settings.google_enabled} className="size-4" />
          Google AdSense enabled
        </label>

        <div className="space-y-1.5">
          <label htmlFor="house_video_path" className="text-sm font-medium">
            House ad image/video URL
          </label>
          <input
            key={settings.house_video_path}
            id="house_video_path"
            name="house_video_path"
            defaultValue={settings.house_video_path}
            className={FIELD}
          />
          <p className="text-xs text-muted-foreground">
            Any publicly reachable image or MP4 URL, or upload a file below — point this at your own hosted file
            to swap the ad without a redeploy.
          </p>
        </div>

        <div className="space-y-1.5 border-t border-border/60 pt-4">
          <p className="text-sm font-medium">Or upload a file</p>
          <AdminAdUploadForm />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="house_click_url" className="text-sm font-medium">
            House ad click-through URL
          </label>
          <input
            id="house_click_url"
            name="house_click_url"
            defaultValue={settings.house_click_url}
            className={FIELD}
          />
        </div>

        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Save
        </button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            House ad performance (last 30 days)
          </h2>
          <a
            href="https://adsense.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary hover:underline"
          >
            Open Google AdSense dashboard ↗
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          Google&rsquo;s own impressions/clicks/RPM live in the AdSense dashboard above — AdSense doesn&rsquo;t
          expose click data to publishers, so only the house ad&rsquo;s numbers are tracked here.
        </p>

        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Impressions</div>
            <div className="text-2xl font-bold tracking-tight">{totalImpressions}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Clicks</div>
            <div className="text-2xl font-bold tracking-tight">{totalClicks}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CTR</div>
            <div className="text-2xl font-bold tracking-tight">{ctr === "–" ? ctr : `${ctr}%`}</div>
          </div>
        </div>

        {eventsError && <p className="text-sm text-destructive">Failed to load ad events: {eventsError.message}</p>}

        {days.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full max-w-md text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="p-2 font-medium">Date</th>
                  <th className="p-2 font-medium">Impressions</th>
                  <th className="p-2 font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {days.map(([day, v]) => (
                  <tr key={day} className="border-b border-border/60 last:border-0">
                    <td className="p-2">{day}</td>
                    <td className="p-2">{v.impressions}</td>
                    <td className="p-2">{v.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
