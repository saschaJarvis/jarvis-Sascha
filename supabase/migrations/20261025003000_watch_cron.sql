-- Wächter alle 5 Minuten: Supabase pg_cron ruft /api/cron/watch auf (Vercel Hobby erlaubt nur tägliche Crons).
-- Der geheime Schlüssel (= Vercel-Variable CRON_SECRET) liegt im Supabase Vault unter 'jarvis_cron_secret'
-- und wird NICHT im Code gespeichert. Einmalig anlegen mit:
--   select vault.create_secret('<CRON_SECRET>', 'jarvis_cron_secret', 'Wächter-Aufruf /api/cron/watch');
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.schedule('jarvis-watch', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://jarvis-sascha.vercel.app/api/cron/watch',
    headers := jsonb_build_object('content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'jarvis_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
