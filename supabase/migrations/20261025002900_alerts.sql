-- Warnungen: Krypto-Abfluss/-Eingang, starke Kursbewegung, neuer Kontoauszug.
-- Kanäle: Web-Push aufs iPhone (Home-Bildschirm-App) und Telegram (eigener Bot des Nutzers).
-- Geprüft wird serverseitig alle 5 Minuten (pg_cron → /api/cron/watch).

create table public.alert_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kinds jsonb not null default '{"outflow": true, "inflow": true, "price": true, "statement": true}'::jsonb,
  price_threshold_pct numeric(5, 2) not null default 10 check (price_threshold_pct between 1 and 90),
  push_enabled boolean not null default false,
  telegram_bot_token text check (telegram_bot_token is null or telegram_bot_token ~ '^[0-9]{5,15}:[A-Za-z0-9_-]{30,50}$'),
  telegram_bot_name text,
  telegram_webhook_secret text,
  telegram_link_code text,
  telegram_chat_id bigint,
  telegram_linked_at timestamptz,
  price_anchor jsonb,                  -- Kurse (EUR) zu Beginn des Tages – Vergleich nur über Kurse, nicht über Ein-/Auszahlungen
  price_anchor_day date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger alert_settings_updated before update on public.alert_settings for each row execute function app.set_updated_at();

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

-- Letzter bekannter Bestand je Wallet und Coin/Token (für Abfluss-/Eingangserkennung)
create table public.wallet_snapshots (
  user_id uuid not null references auth.users (id) on delete cascade,
  wallet_key text not null,            -- z. B. 'btc:<wallet-id>'
  symbol text not null,
  amount numeric not null,
  label text,
  updated_at timestamptz not null default now(),
  primary key (user_id, wallet_key, symbol)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('outflow', 'inflow', 'price', 'statement', 'test')),
  severity text not null default 'info' check (severity in ('info', 'warn', 'critical')),
  title text not null,
  body text not null,
  url text,
  dedup_key text not null,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  push_ok boolean,
  telegram_ok boolean,
  error text,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);
create index alerts_pending on public.alerts (send_after) where sent_at is null;
create index alerts_user_recent on public.alerts (user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['alert_settings', 'push_subscriptions', 'wallet_snapshots', 'alerts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_own', t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (app.mfa_ok()) with check (app.mfa_ok())', t || '_mfa', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
