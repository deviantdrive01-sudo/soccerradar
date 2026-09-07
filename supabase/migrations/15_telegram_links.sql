-- One row per website user, tracking their Telegram account link. link_code/
-- code_expires_at hold a pending, short-lived linking code generated from the
-- website; chat_id/linked_at get filled in by the bot once that code is
-- confirmed.
--
-- No client-side insert/update policy is defined on purpose: a row-ownership
-- check alone (auth.uid() = user_id) would still let a signed-in user PATCH
-- their own row's chat_id directly via the anon key + REST API, bypassing the
-- bot's code verification entirely — they could set it to someone else's real
-- chat_id and hijack that person's /mybookings data the next time that chat
-- messages the bot. Every write (generating a code, confirming a link,
-- unlinking) goes through the service-role client instead, from trusted
-- server code that decides for itself which columns are touched. Only select
-- is exposed to the owner, so the account page can show link status.
create table if not exists telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  chat_id bigint unique,
  link_code text unique,
  code_expires_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table telegram_links enable row level security;

drop policy if exists "users can create their own telegram link code" on telegram_links;
drop policy if exists "users can regenerate their own telegram link code" on telegram_links;

drop policy if exists "users can view their own telegram link" on telegram_links;
create policy "users can view their own telegram link"
  on telegram_links for select using (auth.uid() = user_id);
