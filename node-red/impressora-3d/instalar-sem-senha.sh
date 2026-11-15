#!/usr/bin/env bash
# Instala a aba "Impressora 3D" direto nos arquivos do Node-RED (não precisa da senha do editor).
# Para o Node-RED, instala o Dashboard 2, junta a aba ao arquivo de fluxos (com backup) e liga de novo.
# Pede a senha do sudo (a mesma do login SSH) para parar/ligar o serviço.
set -e
BASE_URL="https://raw.githubusercontent.com/gabrielpossimoser240483/gabriel-possimoser/7b19cdb/node-red/impressora-3d"
FLUXO_NOVO="${FLUXO:-}"
USERDIR="${USERDIR:-}"

# ---- descobre como o Node-RED roda
SERVICO=""
for s in nodered node-red; do
  if systemctl list-unit-files 2>/dev/null | grep -q "^$s.service"; then SERVICO=$s; break; fi
done
# o Node-RED troca o nome do processo para "node-red" (os argumentos somem do ps)
PID_NR=$(pgrep -x node-red | head -1 || true)
USUARIO_NR=""
[ -n "$PID_NR" ] && USUARIO_NR=$(ps -o user:32= -p "$PID_NR" | tr -d ' ')
if [ -z "$USERDIR" ] && [ -n "$SERVICO" ]; then
  USERDIR=$(systemctl cat "$SERVICO" 2>/dev/null | grep -E '^ExecStart' | grep -oE '(-u|--userDir)[ =][^ ]+' | awk '{print $NF}' | sed 's/^--userDir=//' | head -1)
  [ -n "$USUARIO_NR" ] || USUARIO_NR=$(systemctl show "$SERVICO" -p User --value 2>/dev/null)
fi
if [ -z "$USERDIR" ]; then
  if [ -n "$USUARIO_NR" ]; then CASA=$(getent passwd "$USUARIO_NR" | cut -d: -f6); else CASA=$HOME; fi
  USERDIR="$CASA/.node-red"
fi
[ -n "$USUARIO_NR" ] || USUARIO_NR=$(whoami)
if [ ! -d "$USERDIR" ]; then echo "ERRO: não achei a pasta do Node-RED ($USERDIR)."; exit 1; fi

# arquivo de fluxos: o definido no settings.js, senão o maior flows*.json
FLOWFILE=$(grep -oE "^[[:space:]]*flowFile:[[:space:]]*['\"][^'\"]+" "$USERDIR/settings.js" 2>/dev/null | sed -E "s/.*['\"]//" | head -1)
[ -n "$FLOWFILE" ] || FLOWFILE=$(cd "$USERDIR" && ls -S flows*.json 2>/dev/null | grep -v _cred | head -1)
[ -n "$FLOWFILE" ] || FLOWFILE="flows.json"
case "$FLOWFILE" in /*) ;; *) FLOWFILE="$USERDIR/$FLOWFILE";; esac

echo "Node-RED: pasta $USERDIR · fluxos $(basename "$FLOWFILE") · usuário $USUARIO_NR · serviço ${SERVICO:-nenhum}"
SUDO=""; [ "$(whoami)" = "$USUARIO_NR" ] || SUDO="sudo -u $USUARIO_NR"

echo "1/5 Baixando a aba..."
TMP=$(mktemp -d)
if [ -n "$FLUXO_NOVO" ]; then cp "$FLUXO_NOVO" "$TMP/aba.json"; else curl -fsSL "$BASE_URL/impressora-3d.json" -o "$TMP/aba.json"; fi
chmod 644 "$TMP/aba.json"; chmod 755 "$TMP"

echo "2/5 Instalando o Dashboard 2 (pode levar alguns minutos)..."
if [ -d "$USERDIR/node_modules/@flowfuse/node-red-dashboard" ]; then
  echo "    já instalado."
else
  (cd "$USERDIR" && $SUDO npm install --no-fund --no-audit --omit=dev @flowfuse/node-red-dashboard >/dev/null)
  echo "    instalado."
fi

echo "3/5 Parando o Node-RED..."
if [ -n "${PARAR:-}" ]; then eval "$PARAR"
elif [ -n "$SERVICO" ]; then sudo systemctl stop "$SERVICO"
else echo "ERRO: não achei o serviço do Node-RED (nodered). Pare o Node-RED e rode de novo com PARAR=true LIGAR=true."; exit 1; fi
sleep 2

echo "4/5 Colocando a aba (backup em $(basename "$FLOWFILE").antes-impressora3d)..."
[ -f "$FLOWFILE" ] && $SUDO cp "$FLOWFILE" "$FLOWFILE.antes-impressora3d"
$SUDO node - "$FLOWFILE" "$TMP/aba.json" <<'JS'
const fs = require('fs')
const [arq, novoArq] = process.argv.slice(2)
let atual = []
try { atual = JSON.parse(fs.readFileSync(arq, 'utf8')) } catch (e) { atual = [] }
if (!Array.isArray(atual)) atual = atual.flows || []
const novos = JSON.parse(fs.readFileSync(novoArq, 'utf8'))
const ids = new Set(novos.map(n => n.id))
let flows = atual.filter(n => !ids.has(n.id))
const meuBase = novos.find(n => n.type === 'ui-base')
const baseExistente = flows.find(n => n.type === 'ui-base')
let lista = novos
if (meuBase && baseExistente) {
  lista = novos.filter(n => n !== meuBase).map(n => (n.ui === meuBase.id ? { ...n, ui: baseExistente.id } : n))
  // usa o mesmo tema (cores) das páginas que já existem e coloca a página no fim do menu
  const meuTema = novos.find(n => n.type === 'ui-theme')
  const paginaExistente = flows.find(n => n.type === 'ui-page' && n.ui === baseExistente.id && n.theme)
  const temaExistente = paginaExistente && flows.find(n => n.id === paginaExistente.theme)
  const ordem = Math.max(0, ...flows.filter(n => n.type === 'ui-page').map(n => Number(n.order) || 0)) + 1
  lista = lista.filter(n => !(temaExistente && meuTema && n.id === meuTema.id)).map(n => {
    if (n.type !== 'ui-page') return n
    return { ...n, order: ordem, theme: temaExistente ? temaExistente.id : n.theme }
  })
}
fs.writeFileSync(arq, JSON.stringify(flows.concat(lista), null, 4))
console.log('BASE=' + ((baseExistente && baseExistente.path) || (meuBase && meuBase.path) || '/dashboard'))
JS
BASE_DASH=$($SUDO node -e "const f=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const b=f.find(n=>n.type==='ui-base');console.log((b&&b.path)||'/dashboard')" "$FLOWFILE")

echo "5/5 Ligando o Node-RED..."
if [ -n "${LIGAR:-}" ]; then eval "$LIGAR"; else sudo systemctl start "$SERVICO"; fi
rm -rf "$TMP"
sleep 3
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
PORTA=$(grep -oE "^[[:space:]]*uiPort:[^0-9]*[0-9]+" "$USERDIR/settings.js" 2>/dev/null | grep -oE '[0-9]+$' | head -1)
echo ""
echo "PRONTO! Abra no navegador:  http://${IP:-IP-DESTA-MAQUINA}:${PORTA:-1880}${BASE_DASH}/impressora-3d"
echo "Se algo der errado, o fluxo antigo está salvo em $FLOWFILE.antes-impressora3d"
