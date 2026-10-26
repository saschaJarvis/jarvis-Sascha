-- Wächter jede Minute statt alle 5 Minuten (schnellere Kurs-, Ab- und Zufluss-Warnungen).
-- Gleicher Job-Name → cron.schedule ersetzt den bestehenden Zeitplan. Wallet-Abrufe bleiben 2–5 Min.
-- zwischengespeichert, die öffentlichen Blockchain-APIs werden dadurch nicht häufiger abgefragt.
select cron.schedule('jarvis-watch', '* * * * *', $$
  select net.http_post(
    url := 'https://jarvis-sascha.vercel.app/api/cron/watch',
    headers := jsonb_build_object('content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'jarvis_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$$);
