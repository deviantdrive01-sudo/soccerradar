import "server-only";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

/** Shape of the subset of a Telegram Bot API update this app actually reads. */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    chat: { id: number; type: string };
    from?: TelegramUser;
    text?: string;
    /** Present as a service-message field when one or more users join the chat. */
    new_chat_members?: TelegramUser[];
  };
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

/** Sends a plain-text message to a chat (a DM, the Discussion Group, or the Channel by @username). */
export async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }
}

/** Sends a photo by URL (Telegram fetches it itself — no need to pipe image bytes through this server) with an optional caption. */
export async function sendTelegramPhoto(chatId: number | string, photoUrl: string, caption?: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken()}/sendPhoto`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram sendPhoto failed: ${res.status} ${body}`);
  }
}

/** The bot's own @username — used to build the t.me deep link for account linking. */
export async function getBotUsername(): Promise<string> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken()}/getMe`);
  if (!res.ok) throw new Error(`Telegram getMe failed: ${res.status}`);
  const json = await res.json();
  const username = json?.result?.username;
  if (typeof username !== "string") throw new Error("Telegram getMe returned no username");
  return username;
}

/**
 * Live subscriber count for the announcement channel — not cached locally
 * (Telegram is the source of truth), so a missing env var or a failed
 * request just means "unknown" rather than something worth crashing a page
 * over. Used by the admin overview's Telegram stat card.
 */
export async function getChannelMemberCount(): Promise<number | null> {
  const channel = process.env.TELEGRAM_CHANNEL_CHAT_ID;
  if (!channel) return null;
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken()}/getChatMemberCount?chat_id=${encodeURIComponent(channel)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.result === "number" ? json.result : null;
  } catch {
    return null;
  }
}
