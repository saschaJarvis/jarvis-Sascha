-- Stimme (ElevenLabs) und Siri-Zugang.
-- voice_settings: gewählte Stimme/Tempo je Nutzer. Der API-Schlüssel liegt NICHT hier, sondern als ELEVENLABS_API_KEY bei Vercel.
-- siri_tokens: persönliche Schlüssel für den Siri-Kurzbefehl. Gespeichert wird nur der SHA-256-Hash; jederzeit sperrbar.

create table public.voice_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  voice_id text check (voice_id is null or voice_id ~ '^[A-Za-z0-9]{10,40}$'),
  voice_name text check (voice_name is null or length(voice_name) <= 120),
  speed numeric(3, 2) not null default 1.00 check (speed between 0.70 and 1.20),
  quality text not null default 'fast' check (quality in ('fast', 'best')),
  updated_at timestamptz not null default now()
);
create trigger voice_settings_updated before update on public.voice_settings for each row execute function app.set_updated_at();

create table public.siri_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null default 'iPhone' check (length(label) <= 60),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index siri_tokens_user on public.siri_tokens (user_id);

do $$
declare t text;
begin
  foreach t in array array['voice_settings', 'siri_tokens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_own', t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (app.mfa_ok()) with check (app.mfa_ok())', t || '_mfa', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
