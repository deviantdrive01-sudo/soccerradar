import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SCHEDULED_BROADCAST_INFO, type ScheduledBroadcastType } from "@/lib/telegram-broadcasts";
import { AdminTelegramTriggerButton } from "@/components/admin-telegram-trigger-button";
import { todayKey } from "@/lib/date-key";

export const dynamic = "force-dynamic";

const ORDER: ScheduledBroadcastType[] = [
  "general",
  "top-bookings-1",
  "top-bookings-2",
  "top-bookings-3",
  "banger",
  "corners",
  "over15",
  "international",
  "top-match",
];

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export default async function AdminTelegramPage() {
  const supabase = createAdminSupabaseClient();

  const { data: logRows } = await supabase
    .from("telegram_broadcast_log")
    .select("category, detail, broadcast_date, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const today = todayKey();
  const todaysStatus = new Map<string, { count: number; lastAt: string }>();
  for (const row of logRows ?? []) {
    if (row.broadcast_date !== today) continue;
    const existing = todaysStatus.get(row.category);
    if (existing) {
      existing.count += 1;
      if (row.created_at > existing.lastAt) existing.lastAt = row.created_at;
    } else {
      todaysStatus.set(row.category, { count: 1, lastAt: row.created_at });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telegram</h1>
        <p className="text-sm text-muted-foreground">
          The channel&apos;s scheduled post calendar — 9 slots between 08:00-12:00 UTC, driven by
          .github/workflows/telegram-broadcasts.yml (plus the original digest&apos;s own Vercel Cron entry). &ldquo;Send
          now&rdquo; fires the exact same logic the schedule uses, including its once-per-day dedup — it won&apos;t
          double-post something already sent today.
        </p>
      </div>

      {/* Phone: stacked cards */}
      <div className="space-y-3 sm:hidden">
        {ORDER.map((type) => {
          const info = SCHEDULED_BROADCAST_INFO[type];
          const status = todaysStatus.get(type);
          return (
            <div key={type} className="space-y-2 rounded-md border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{info.label}</div>
                  <div className="text-xs text-muted-foreground">{info.scheduledTime}</div>
                </div>
                <AdminTelegramTriggerButton type={type} />
              </div>
              <div className="border-t border-border/60 pt-2 text-xs">
                {status ? (
                  <span className="text-primary">
                    Sent{status.count > 1 ? ` ${status.count}×` : ""} · last {timeLabel(status.lastAt)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not sent yet</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* sm+: table */}
      <div className="hidden overflow-x-auto rounded-md border border-border/60 sm:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Broadcast</th>
              <th className="px-3 py-2">Scheduled</th>
              <th className="px-3 py-2">Today</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((type) => {
              const info = SCHEDULED_BROADCAST_INFO[type];
              const status = todaysStatus.get(type);
              return (
                <tr key={type} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium">{info.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{info.scheduledTime}</td>
                  <td className="px-3 py-2">
                    {status ? (
                      <span className="text-primary">
                        Sent{status.count > 1 ? ` ${status.count}×` : ""} · last {timeLabel(status.lastAt)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not sent yet</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AdminTelegramTriggerButton type={type} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</h2>

        {/* Phone: stacked cards */}
        <div className="space-y-2 sm:hidden">
          {(logRows ?? []).map((row, i) => (
            <div key={i} className="rounded-md border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">
                  {SCHEDULED_BROADCAST_INFO[row.category as ScheduledBroadcastType]?.label ?? row.category}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "UTC" })}
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {row.detail ?? "—"} · {row.broadcast_date}
              </div>
            </div>
          ))}
          {(logRows ?? []).length === 0 && (
            <div className="rounded-md border border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing sent yet.
            </div>
          )}
        </div>

        {/* sm+: table */}
        <div className="hidden overflow-x-auto rounded-md border border-border/60 sm:block">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Broadcast</th>
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Sent at (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {(logRows ?? []).map((row, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium">
                    {SCHEDULED_BROADCAST_INFO[row.category as ScheduledBroadcastType]?.label ?? row.category}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.detail ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.broadcast_date}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "UTC" })}
                  </td>
                </tr>
              ))}
              {(logRows ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    Nothing sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
