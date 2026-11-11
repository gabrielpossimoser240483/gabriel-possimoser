# 📋 Recados — app de recados de trabalho para iPhone

App web (PWA) em português para registrar e organizar recados de trabalho com o **mínimo de esforço**:

- 🎤 **Grave um áudio** (botão grande) ou 📋 **cole uma mensagem do WhatsApp**.
- ✨ A IA (**Claude Haiku**, da Anthropic) preenche sozinha: **quem mandou, assunto, resumo, prazo e prioridade**. Você confere, ajusta se quiser e salva.
- 🗂️ Lista **organizada por dia**, com filtros por **pessoa, prioridade e status**, **busca** por qualquer palavra e **marcar como resolvido com um toque**.
- ⏰ **Lembretes push** no iPhone antes de cada prazo.
- ☀️ **Resumo do dia** gerado pela IA: recados de hoje, pendências e prazos próximos.
- ☁️ **Login e sincronização na nuvem** (Supabase, grátis). Modo escuro automático.
- 🔒 A chave da Anthropic fica **só no servidor** (Vercel) — nunca no código do app nem no iPhone.

---

## Como funciona (visão geral)

```
iPhone (app na Tela de Início)
   │  login, recados  ───────────────►  Supabase (banco + login, grátis)
   │  "organize este texto" ─────────►  Vercel /api (servidor, grátis) ──► Claude Haiku (Anthropic)
   │                                         ▲
   └◄── notificação push ◄───────────────────┘  (o Supabase chama /api/lembretes a cada 5 min)
```

Você vai criar 3 contas gratuitas: **GitHub** (guardar o código), **Supabase** (banco de dados e login) e **Vercel** (publicar o app). Mais a conta da **Anthropic** (a IA, paga por uso — centavos por mês para uso pessoal).

> ⏱️ Tempo total: uns 30–40 minutos, sem precisar instalar nada no computador.

---

## Passo 1 — Coloque o código no seu GitHub

Se este código já está no seu repositório do GitHub, pule para o Passo 2.

1. Crie uma conta em **https://github.com** (grátis).
2. Crie um repositório novo (botão **New**), pode ser **Private**.
3. Envie os arquivos deste projeto para ele (botão **Add file → Upload files**, arraste todas as pastas e arquivos e clique em **Commit changes**).

---

## Passo 2 — Crie o banco de dados no Supabase

1. Acesse **https://supabase.com** → **Start your project** → entre com sua conta do GitHub.
2. Clique em **New project**:
   - **Name:** `recados`
   - **Database Password:** clique em *Generate a password* (guarde num lugar seguro).
   - **Region:** `South America (São Paulo)`.
   - Clique em **Create new project** e espere ~2 minutos.
3. No menu da esquerda, abra **SQL Editor** → **New query**.
4. Abra o arquivo [`supabase/schema.sql`](supabase/schema.sql) deste projeto, copie **todo** o conteúdo, cole no editor e clique em **Run**. Deve aparecer *Success. No rows returned*.
5. Pegue as chaves do projeto: menu **Project Settings** (engrenagem) → **API Keys**. Anote:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`) — em *Project Settings → Data API* ou no topo da página *API Keys*.
   - **Publishable key** (começa com `sb_publishable_...`). Se o seu painel mostrar as chaves antigas, use a **anon public**.
   - **Secret key** (começa com `sb_secret_...`; clique em *Reveal*). Nas chaves antigas, é a **service_role**.
   > ⚠️ A **secret key** dá acesso total ao banco. Ela só vai na Vercel, **nunca** no código nem em mensagens.
6. Configure o login: menu **Authentication** → **Sign In / Providers** → **Email**: deixe **ativado**. (Opcional, para não precisar confirmar e-mail: desative **Confirm email**.)

---

## Passo 3 — Crie a chave da API da Anthropic (a IA)

1. Acesse **https://console.anthropic.com** e crie sua conta.
2. Vá em **Settings → Billing** (Plans & Billing) e adicione créditos (o mínimo, ex.: US$ 5, dura muito tempo: o Claude Haiku custa frações de centavo por recado).
   - Dica: em **Settings → Limits** você pode definir um **limite de gasto mensal** para ficar tranquilo.
3. Vá em **Settings → API Keys** → **Create Key**, dê o nome `recados` e clique em **Create**.
4. **Copie a chave** (começa com `sk-ant-...`). Ela só aparece uma vez. Guarde até o Passo 4.
   > 🔒 Nunca cole essa chave no código, no GitHub ou no app. Ela vai **só** nas configurações da Vercel.

---

## Passo 4 — Publique o app na Vercel (grátis)

1. Acesse **https://vercel.com** → **Sign Up** → escolha **Hobby** (grátis) → entre com o GitHub.
2. Clique em **Add New… → Project** e escolha o repositório deste app → **Import**.
3. Em **Framework Preset**, deixe **Other**. Não precisa mexer em mais nada.
4. Abra **Environment Variables** e adicione uma por uma (nome à esquerda, valor à direita):

   | Nome | Valor |
   |---|---|
   | `ANTHROPIC_API_KEY` | a chave `sk-ant-...` do Passo 3 |
   | `SUPABASE_URL` | a Project URL do Passo 2 |
   | `SUPABASE_PUBLIC_KEY` | a Publishable key (ou anon) |
   | `SUPABASE_SECRET_KEY` | a Secret key (ou service_role) |

5. Clique em **Deploy** e espere 1 minuto. 🎉 A Vercel mostra o endereço do seu app, algo como `https://recados-seunome.vercel.app`. **Anote esse endereço.**
6. Volte ao Supabase → **Authentication → URL Configuration** → em **Site URL** coloque o endereço do app (ex.: `https://recados-seunome.vercel.app`) e salve. Assim o link de confirmação do e-mail leva para o app.

### 4.1 — Ligue os lembretes (notificações push)

Não precisa criar chaves: o app gera tudo sozinho.

1. No Supabase, abra **SQL Editor → New query**, cole **todo** o conteúdo de [`supabase/lembretes.sql`](supabase/lembretes.sql) e clique em **Run**. Não precisa editar nada.
2. Abra o app uma vez (pelo endereço da Vercel). Nesse momento ele registra o próprio endereço e cria as chaves de notificação.

Pronto: a cada 5 minutos o Supabase pede ao app para verificar os prazos. Você recebe o aviso **1 hora antes** de cada prazo (para mudar, crie a variável `LEMBRETE_ANTECEDENCIA_MIN` na Vercel, ex.: `30`).

### 4.2 — (Opcional, recomendado) Transcrição de áudio de alta qualidade

Sem configurar nada, o app usa o **reconhecimento de voz do próprio iPhone**. Para uma transcrição mais precisa (e que funciona melhor com o app instalado), use o Whisper grátis da Groq:

1. Crie conta em **https://console.groq.com** → **API Keys → Create API Key**.
2. Na Vercel, adicione `GROQ_API_KEY` com essa chave e faça **Redeploy**.

### 4.3 — Proteção automática

A **primeira conta** que entrar no app vira a **dona**: só ela consegue usar a IA, e a opção "criar conta" some da tela de login. Assim ninguém gasta seus créditos da Anthropic, mesmo que descubra o endereço do app.

Opcional (proteção extra): no Supabase, **Authentication → Sign In / Providers**, desative **Allow new users to sign up**. Os e-mails liberados também ficam na lista `EMAILS_LIBERADOS` em `api/_lib.js`. Ou, na Vercel, crie `ALLOWED_EMAILS` com os e-mails que podem usar a IA (separados por vírgula); com ela, a regra do "dono" deixa de valer.

> 🔐 **Segurança:** a chave da Anthropic, a secret key do Supabase e as chaves VAPID ficam apenas nas variáveis da Vercel. O app no iPhone só recebe a URL e a chave **pública** do Supabase (feita para ser pública). Cada usuário só enxerga os próprios recados graças às regras de segurança (Row Level Security) criadas no `schema.sql`. As rotas de IA exigem login válido.

---

## Passo 5 — Instale no iPhone

1. No iPhone, abra o **Safari** (precisa ser o Safari) e acesse o endereço do app.
2. Toque em **Compartilhar** (o quadrado com a seta ↑, na barra de baixo).
3. Role e toque em **Adicionar à Tela de Início** → **Adicionar**.
4. Abra o app pelo novo ícone **Recados** na Tela de Início.
5. Toque em **Ainda não tenho conta — criar**, informe e-mail e senha. (Se a confirmação de e-mail estiver ativa, toque no link que chegar no e-mail e depois entre no app com e-mail e senha.)
6. Vá na aba **Ajustes → Ativar lembretes** e toque em **Permitir**. Use **Enviar notificação de teste** para conferir.

> 📱 Notificações em apps web precisam de **iOS 16.4 ou mais novo** e só funcionam com o app **aberto pelo ícone da Tela de Início** (não dentro do Safari).

---

## Como usar no dia a dia

- **Chegou um WhatsApp:** toque e segure na mensagem → **Copiar** (ou selecione várias e copie). No app: **Novo → Colar**. A IA organiza sozinha; confira e toque em **Salvar**.
- **Recado falado:** **Novo → 🎤** fale → toque de novo para parar. A IA organiza sozinha.
- **Resolveu?** Toque no círculo à esquerda do recado. Errou? Toque em **Desfazer**.
- **Editar:** toque no recado.
- **Achar algo:** digite qualquer palavra na busca (procura em quem mandou, assunto, resumo e texto original).
- **Começo do dia:** aba **Resumo**.

---

## Problemas comuns

| Sintoma | Solução |
|---|---|
| App mostra “Quase lá!” com uma lista de nomes | Faltam essas variáveis na Vercel. Adicione e faça **Redeploy**. |
| “A chave da Anthropic é inválida” | Confira `ANTHROPIC_API_KEY` na Vercel (sem espaços) e faça Redeploy. |
| “Sem créditos na conta da Anthropic” | Adicione créditos em console.anthropic.com → Billing. |
| Não chega notificação | iOS 16.4+, app aberto pelo ícone, lembretes ativados em Ajustes, e o `lembretes.sql` rodado no Supabase. No Supabase rode `select status_code, content from net._http_response order by created desc limit 5;` — deve mostrar `200`. |
| Microfone não funciona | Ajustes do iPhone → Safari/Recados → Microfone: permitir. Alternativa sempre disponível: toque no campo de texto e use o 🎤 do teclado do iPhone. Ou configure a Groq (4.2). |
| “Email not confirmed” | Clique no link enviado por e-mail, ou desative *Confirm email* no Supabase. |
| Projeto do Supabase “pausado” | No plano grátis, projetos sem uso por 7 dias são pausados. Entre no painel do Supabase e clique em **Restore**. Usar o app regularmente evita isso. |

---

## Custos

- **Supabase** (Free), **Vercel** (Hobby) e **Groq** (Free): R$ 0 para uso pessoal.
- **Anthropic (Claude Haiku):** cobrado por uso; organizar um recado custa uma fração de centavo. Defina um limite de gasto no console para ficar tranquilo.

---

## Para quem quer mexer no código

```
public/            ← o app (HTML, CSS, JS puro; sem build)
  index.html  app.js  styles.css  sw.js  manifest.webmanifest  icons/
api/               ← funções de servidor (Vercel, Node 20+)
  _lib.js          ← login, Supabase, chamada ao Claude (chave só aqui)
  extrair.js       ← texto → remetente/assunto/resumo/prazo/prioridade (Claude Haiku, saída JSON estruturada)
  resumo.js        ← resumo do dia (Claude Haiku)
  transcrever.js   ← áudio → texto (opcional, Groq Whisper)
  lembretes.js     ← envia os pushes (chamado pelo pg_cron do Supabase)
  config.js        ← entrega só configurações públicas ao app
  _auto.js         ← cria sozinho as chaves de notificação e o segredo do agendador
supabase/
  schema.sql         ← tabelas + segurança (RLS)
  lembretes.sql      ← agendamento a cada 5 min (sem edição)
```

- Modelo da IA: `claude-haiku-5-5` (troque com a variável `ANTHROPIC_MODEL`).
- Para testar localmente: `npm install` e `npx vercel dev` (com as variáveis num arquivo `.env`, veja `.env.example`).
- `npm run check` verifica a sintaxe dos arquivos.
