-- =====================================================================
-- Lembretes (notificações de prazo). Cole tudo no SQL Editor do Supabase
-- e clique em "Run". Não precisa editar nada. Pode rodar mais de uma vez.
--
-- O que faz: cria uma tabela de configuração só do servidor, gera um
-- segredo aleatório e agenda, a cada 5 minutos, uma chamada ao app na
-- Vercel, que envia os avisos dos prazos que estão chegando.
-- O endereço do app é registrado sozinho quando você abre o app.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.app_config (
  chave      text primary key,
  valor      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (chave, valor)
values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (chave) do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'lembretes-recados';

select cron.schedule(
  'lembretes-recados',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := (select valor from public.app_config where chave = 'app_url') || '/api/lembretes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select valor from public.app_config where chave = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (select 1 from public.app_config where chave = 'app_url');
  $$
);

-- Para conferir se está rodando (status_code = 200):
-- select status_code, content, created from net._http_response order by created desc limit 5;
