-- =====================================================================
-- Recados de Trabalho — estrutura do banco (cole tudo no SQL Editor do
-- Supabase e clique em "Run"). Pode rodar mais de uma vez sem problema.
-- =====================================================================

create table if not exists public.recados (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  remetente        text not null default '',
  assunto          text not null default '',
  resumo           text not null default '',
  texto_original   text not null default '',
  origem           text not null default 'texto' check (origem in ('audio', 'texto', 'manual')),
  prazo            timestamptz,
  prioridade       text not null default 'media' check (prioridade in ('alta', 'media', 'baixa')),
  status           text not null default 'pendente' check (status in ('pendente', 'resolvido')),
  lembrete_enviado boolean not null default false,
  resolvido_em     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists recados_usuario_data on public.recados (user_id, created_at desc);
create index if not exists recados_lembretes on public.recados (prazo)
  where status = 'pendente' and lembrete_enviado = false and prazo is not null;

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_usuario on public.push_subscriptions (user_id);

-- Atualiza updated_at e resolvido_em automaticamente
create or replace function public.recados_ao_atualizar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'resolvido' and old.status is distinct from 'resolvido' then
    new.resolvido_em := now();
  elsif new.status = 'pendente' then
    new.resolvido_em := null;
  end if;
  -- Se o prazo mudou, o lembrete volta a valer
  if new.prazo is distinct from old.prazo then
    new.lembrete_enviado := false;
  end if;
  return new;
end $$;

drop trigger if exists recados_ao_atualizar on public.recados;
create trigger recados_ao_atualizar before update on public.recados
  for each row execute function public.recados_ao_atualizar();

-- Segurança: cada pessoa só enxerga e altera os próprios dados (Row Level Security)
alter table public.recados enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "recados do dono" on public.recados;
create policy "recados do dono" on public.recados
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "inscricoes do dono" on public.push_subscriptions;
create policy "inscricoes do dono" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.recados to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Configuração interna do servidor (chaves de notificação etc.). Sem políticas:
-- só o servidor (chave secreta) consegue ler e gravar.
create table if not exists public.app_config (
  chave      text primary key,
  valor      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
