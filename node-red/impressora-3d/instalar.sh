#!/usr/bin/env bash
# Instala a aba "Impressora 3D" no Node-RED desta máquina, sem abrir o editor.
#   curl -fsSL https://raw.githubusercontent.com/gabrielpossimoser240483/gabriel-possimoser/claude/gifted-cerf-su76ck/node-red/impressora-3d/instalar.sh | bash
# Variáveis opcionais: NR=http://127.0.0.1:1880  FLUXO=/caminho/para/impressora-3d.json
set -e
NR="${NR:-http://127.0.0.1:1880}"
BASE_URL="https://raw.githubusercontent.com/gabrielpossimoser240483/gabriel-possimoser/claude/gifted-cerf-su76ck/node-red/impressora-3d"
ARQ="${FLUXO:-$HOME/.node-red/lib/flows/impressora-3d.json}"

echo "1/4 Baixando a aba..."
if [ -z "$FLUXO" ]; then
  mkdir -p "$(dirname "$ARQ")"
  curl -fsSL "$BASE_URL/impressora-3d.json" -o "$ARQ"
fi

echo "2/4 Procurando o Node-RED em $NR ..."
AUTH=()
codigo=$(curl -s -o /dev/null -w "%{http_code}" "$NR/flows" || true)
if [ "$codigo" = "401" ]; then
  echo "    O Node-RED tem senha. Digite o mesmo usuário e senha que você usa para entrar no editor."
  read -r -p "    Usuário: " NRUSER < /dev/tty
  read -r -s -p "    Senha (não aparece enquanto digita): " NRPASS < /dev/tty; echo
  TOKEN=$(curl -s "$NR/auth/token" --data-urlencode "client_id=node-red-admin" --data-urlencode "grant_type=password" \
    --data-urlencode "scope=*" --data-urlencode "username=$NRUSER" --data-urlencode "password=$NRPASS" \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).access_token||"")}catch(e){}})')
  if [ -z "$TOKEN" ]; then echo "ERRO: usuário ou senha errados. Rode o comando de novo."; exit 1; fi
  AUTH=(-H "Authorization: Bearer $TOKEN")
  export TOKEN
  codigo=$(curl -s -o /dev/null -w "%{http_code}" "${AUTH[@]}" "$NR/flows" || true)
fi
if [ "$codigo" != "200" ]; then
  echo "ERRO: o Node-RED não respondeu em $NR (código $codigo). Ele está ligado? Se usa outra porta, rode com NR=http://127.0.0.1:PORTA"
  exit 1
fi

echo "3/4 Verificando o Dashboard 2..."
if curl -s "${AUTH[@]}" -H "Accept: application/json" "$NR/nodes" | grep -q '"@flowfuse/node-red-dashboard"'; then
  echo "    já instalado."
else
  echo "    instalando @flowfuse/node-red-dashboard (pode levar 1 a 3 minutos)..."
  resp=$(curl -s -m 600 -w "\n%{http_code}" "${AUTH[@]}" -H "Content-Type: application/json" -d '{"module":"@flowfuse/node-red-dashboard"}' "$NR/nodes")
  if [ "$(echo "$resp" | tail -n1)" != "200" ]; then
    echo "ERRO ao instalar o dashboard:"; echo "$resp" | head -n -1; exit 1
  fi
  echo "    instalado."
fi

echo "4/4 Colocando a aba Impressora 3D..."
SAIDA=$(node - "$NR" "$ARQ" <<'JS'
const [nr, arq] = process.argv.slice(2)
const novos = JSON.parse(require('fs').readFileSync(arq, 'utf8'))
;(async () => {
  const h = { 'Node-RED-API-Version': 'v2', 'Content-Type': 'application/json' }
  if (process.env.TOKEN) h.Authorization = 'Bearer ' + process.env.TOKEN
  const atual = await (await fetch(nr + '/flows', { headers: h })).json()
  const idsNovos = new Set(novos.map(n => n.id))
  let flows = atual.flows.filter(n => !idsNovos.has(n.id))          // remove versão antiga, se houver
  // se já existe um Dashboard 2 (ui-base), usa o existente em vez de criar outro
  const meuBase = novos.find(n => n.type === 'ui-base')
  const baseExistente = flows.find(n => n.type === 'ui-base')
  let lista = novos
  if (meuBase && baseExistente) {
    lista = novos.filter(n => n !== meuBase).map(n => {
      const c = { ...n }
      if (c.ui === meuBase.id) c.ui = baseExistente.id
      return c
    })
    console.log('    usando o dashboard que já existe (' + (baseExistente.path || '/dashboard') + ')')
  }
  flows = flows.concat(lista)
  const r = await fetch(nr + '/flows', {
    method: 'POST', headers: { ...h, 'Node-RED-Deployment-Type': 'flows' },
    body: JSON.stringify({ rev: atual.rev, flows })
  })
  if (!r.ok) { console.error('ERRO ao publicar: HTTP ' + r.status + ' ' + await r.text()); process.exit(1) }
  const base = (baseExistente && meuBase ? baseExistente.path : (meuBase && meuBase.path)) || '/dashboard'
  console.log('BASE=' + base)
})().catch(e => { console.error('ERRO: ' + e.message); process.exit(1) })
JS
)
echo "$SAIDA" | grep -v '^BASE=' || true
BASE=$(echo "$SAIDA" | grep '^BASE=' | cut -d= -f2)
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "PRONTO! Abra no navegador:  http://${IP:-IP-DESTA-MAQUINA}:${NR##*:}${BASE:-/dashboard}/impressora-3d"
