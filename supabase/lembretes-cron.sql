-- =====================================================================
-- Agendador dos lembretes: a cada 5 minutos o Supabase chama o seu app
-- na Vercel, que envia as notificações dos prazos que estão chegando.
--
-- ANTES DE RODAR, troque:
--   SEU-APP.vercel.app  -> o endereço do seu app na Vercel
--   SEU_CRON_SECRET     -> o mesmo valor de CRON_SECRET configurado na Vercel
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove um agendamento antigo com o mesmo nome (se existir)
select cron.unschedule(jobid) from cron.job where jobname = 'lembretes-recados';

select cron.schedule(
  'lembretes-recados',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://SEU-APP.vercel.app/api/lembretes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_CRON_SECRET'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Para conferir se está rodando (veja a coluna status_code = 200):
-- select id, status_code, content, created from net._http_response order by created desc limit 10;
