#!/usr/bin/env bash
# Instala a aba "Impressora 3D" num Node-RED que roda no Docker (não precisa da senha do editor).
# Acha o container, instala o Dashboard 2 dentro dele, junta a aba ao arquivo de fluxos (com backup)
# e reinicia o container.
set -e
BASE_URL="https://raw.githubusercontent.com/gabrielpossimoser240483/gabriel-possimoser/7b19cdb/node-red/impressora-3d"
D="docker"; $D ps >/dev/null 2>&1 || D="sudo docker"

echo "Procurando o container do Node-RED..."
C="${CONTAINER:-}"
[ -n "$C" ] || C=$($D ps --format '{{.Names}} {{.Image}}' | grep -iE 'node-?red' | awk 'NR==1{print $1}')
if [ -z "$C" ]; then
  for n in $($D ps --format '{{.Names}}'); do
    if $D top "$n" 2>/dev/null | grep -q 'node-red'; then C=$n; break; fi
  done
fi
if [ -z "$C" ]; then echo "ERRO: não achei o container do Node-RED. Rode: docker ps  e me mande o print."; exit 1; fi
echo "    container: $C"

DADOS=$($D exec "$C" sh -c 'for d in /data /usr/src/node-red/.node-red "$HOME/.node-red"; do [ -f "$d/flows.json" ] || [ -f "$d/settings.js" ] || [ -d "$d/node_modules" ] && { echo "$d"; break; }; done')
[ -n "$DADOS" ] || DADOS=/data
FLOWFILE=$($D exec "$C" node -e "try{const s=require('$DADOS/settings.js');console.log(s.flowFile||'flows.json')}catch(e){console.log('flows.json')}" 2>/dev/null | tail -1)
case "$FLOWFILE" in /*) ;; *) FLOWFILE="$DADOS/$FLOWFILE";; esac
echo "    pasta de dados: $DADOS · fluxos: $FLOWFILE"

echo "1/4 Baixando a aba..."
TMP=$(mktemp -d)
curl -fsSL "$BASE_URL/impressora-3d.json" -o "$TMP/aba.json"
$D cp "$TMP/aba.json" "$C:/tmp/impressora-3d.json"

echo "2/4 Instalando o Dashboard 2 dentro do container (pode levar alguns minutos)..."
if $D exec "$C" test -d "$DADOS/node_modules/@flowfuse/node-red-dashboard"; then
  echo "    já instalado."
else
  $D exec -w "$DADOS" "$C" npm install --no-fund --no-audit --omit=dev @flowfuse/node-red-dashboard >/dev/null
  echo "    instalado."
fi

echo "3/4 Colocando a aba (backup em $(basename "$FLOWFILE").antes-impressora3d)..."
$D exec "$C" sh -c "[ -f '$FLOWFILE' ] && cp '$FLOWFILE' '$FLOWFILE.antes-impressora3d' || true"
cat > "$TMP/juntar.js" <<'JS'
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
console.log(((baseExistente && baseExistente.path) || (meuBase && meuBase.path) || '/dashboard'))
JS
BASE_DASH=$($D exec -i "$C" node - "$FLOWFILE" /tmp/impressora-3d.json < "$TMP/juntar.js" | tail -1)

echo "4/4 Reiniciando o Node-RED..."
$D restart "$C" >/dev/null
rm -rf "$TMP"
sleep 5
PORTA=$($D port "$C" 1880/tcp 2>/dev/null | head -1 | awk -F: '{print $NF}')
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "PRONTO! Abra no navegador:  http://${IP:-IP-DESTA-MAQUINA}:${PORTA:-1880}${BASE_DASH:-/dashboard}/impressora-3d"
echo "Se algo der errado, o fluxo antigo está salvo dentro do container em $FLOWFILE.antes-impressora3d"
