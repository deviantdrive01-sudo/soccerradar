import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AdminBannerUploadForm } from "@/components/admin-banner-upload-form";

export default async function AdminBannerPage() {
  const supabase = createAdminSupabaseClient();
  const { data: settings, error } = await supabase.from("site_settings").select("*").eq("id", 1).single();

  if (error || !settings) {
    return <p className="text-sm text-destructive">Failed to load site settings: {error?.message}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Banner</h1>
        <p className="text-sm text-muted-foreground">
          The promo banner shown above the account section (Overview, Favorites, Collections, Bookings, Profile).
          Upload separate crops for phone and desktop — each is shown only at its matching breakpoint.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3 rounded-md border border-border/60 p-4">
          <div>
            <p className="text-sm font-medium">Mobile banner</p>
            <p className="text-xs text-muted-foreground">Shown below the header on phone-width screens.</p>
          </div>
          {settings.profile_banner_mobile_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded asset, no next/image benefit
            <img
              src={settings.profile_banner_mobile_url}
              alt="Current mobile banner"
              className="w-full max-w-xs rounded-lg border border-border/60"
            />
          ) : (
            <p className="text-xs text-muted-foreground">No mobile banner uploaded yet — the banner won&apos;t show on phones until one is.</p>
          )}
          <AdminBannerUploadForm variant="mobile" />
        </div>

        <div className="space-y-3 rounded-md border border-border/60 p-4">
          <div>
            <p className="text-sm font-medium">Desktop banner</p>
            <p className="text-xs text-muted-foreground">Shown below the header from tablet width up.</p>
          </div>
          {settings.profile_banner_desktop_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded asset, no next/image benefit
            <img
              src={settings.profile_banner_desktop_url}
              alt="Current desktop banner"
              className="w-full rounded-lg border border-border/60"
            />
          ) : (
            <p className="text-xs text-muted-foreground">No desktop banner uploaded yet — the banner won&apos;t show on desktop until one is.</p>
          )}
          <AdminBannerUploadForm variant="desktop" />
        </div>
      </div>
    </div>
  );
}
