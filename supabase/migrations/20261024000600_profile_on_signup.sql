-- Jarvis Sascha – Migration 0006: Profil automatisch anlegen, wenn sich ein Nutzer registriert (Supabase Auth)

create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke all on function app.handle_new_user() from public;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();
