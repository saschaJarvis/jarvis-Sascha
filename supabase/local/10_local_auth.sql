-- NUR FÜR LOKALE ENTWICKLUNG / DEMO.
-- Ersetzt Supabase Auth, solange kein Supabase-Projekt existiert. In Produktion übernimmt Supabase Auth
-- (Passwort + TOTP/Passkey, JWT mit aal2) – diese Tabellen werden dort NICHT angelegt.
-- Zugriff ausschließlich über die Server-Verbindung (Superuser/Service), nie über die Rolle authenticated.

create schema if not exists local_auth;
revoke all on schema local_auth from public, anon, authenticated;

create table if not exists local_auth.credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  password_hash text not null,              -- scrypt$N$r$p$salt$hash
  totp_secret_enc text,                     -- AES-256-GCM, Schlüssel aus AUTH_SECRET
  totp_enabled boolean not null default false,
  totp_last_counter bigint,                 -- Replay-Schutz: derselbe Code nie zweimal
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists local_auth.sessions (
  id_hash text primary key,                 -- SHA-256 des Cookie-Werts
  user_id uuid not null references auth.users (id) on delete cascade,
  password_at timestamptz not null,
  mfa_at timestamptz,                       -- letzte erfolgreiche TOTP-Prüfung (Step-up)
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists sessions_user on local_auth.sessions (user_id);
