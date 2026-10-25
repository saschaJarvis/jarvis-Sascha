-- Übersetzungs-Zwischenspeicher für öffentliche Schlagzeilen (keine Nutzerdaten).
-- Liegt im nicht veröffentlichten Schema „app“: nur der Server (Eigentümer/service_role) liest und schreibt.
create table app.translations (
  src_hash text primary key check (src_hash ~ '^[0-9a-f]{64}$'),
  target_lang text not null default 'de' check (target_lang in ('de')),
  source_text text not null check (length(source_text) <= 2000),
  translated text not null check (length(translated) <= 4000),
  provider text not null check (provider in ('claude', 'deepl', 'test')),
  created_at timestamptz not null default now()
);
create index translations_created on app.translations (created_at);
revoke all on app.translations from public, anon, authenticated;
grant select, insert, update, delete on app.translations to service_role;
