import { createSupabaseReadClient } from "@/lib/supabase/client";
import { AccountMobileNav, AccountSidebarNav } from "@/components/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseReadClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("profile_banner_mobile_url, profile_banner_desktop_url")
    .eq("id", 1)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
      {settings?.profile_banner_mobile_url && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded asset via a public storage URL, not a local/optimizable import
        <img
          src={settings.profile_banner_mobile_url}
          alt=""
          className="w-full rounded-xl sm:hidden"
        />
      )}
      {settings?.profile_banner_desktop_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.profile_banner_desktop_url}
          alt=""
          className="hidden w-full rounded-xl sm:block"
        />
      )}

      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
        <AccountMobileNav />
        <AccountSidebarNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
