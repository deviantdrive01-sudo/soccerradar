import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBotUsername } from "@/lib/telegram";
import { TelegramLinkPanel } from "@/components/telegram-link-panel";

export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: link } = await supabase
    .from("telegram_links")
    .select("chat_id, linked_at")
    .eq("user_id", user.userId)
    .maybeSingle();

  const isLinked = !!link?.chat_id && !!link.linked_at;
  const botUsername = await getBotUsername().catch(() => null);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telegram</h1>
        <p className="text-sm text-muted-foreground">
          Link your account to check your bookings, see your stats, and get today&apos;s predictions from the SoccerRadar
          bot on Telegram.
        </p>
      </div>

      <TelegramLinkPanel isLinked={isLinked} botUsername={botUsername} />
    </div>
  );
}
