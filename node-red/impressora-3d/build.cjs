// Gera impressora-3d.json (fluxo para importar no Node-RED) a partir de src/.
// Uso: node build.cjs
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const SRC = path.join(__dirname, 'src')
const ler = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8')
const id = nome => crypto.createHash('sha1').update('impressora3d:' + nome).digest('hex').slice(0, 16)

const TAB = id('tab')
const nodes = []
const add = n => { nodes.push(n); return n }

// ---------------------------------------------------------------- dashboard (configuração)
const BASE = id('ui-base')
const THEME = id('ui-theme')
const PAGE = id('ui-page')

add({
    id: BASE, type: 'ui-base', name: 'Dashboard', path: '/dashboard', appIcon: '',
    includeClientData: true, acceptsClientConfig: ['ui-notification', 'ui-control'],
    showPathInSidebar: false, headerContent: 'page', navigationStyle: 'default', titleBarStyle: 'default',
    showReconnectNotification: true, notificationDisplayTime: 1, showDisconnectNotification: true, allowInstall: false
})
add({
    id: THEME, type: 'ui-theme', name: 'Impressora 3D',
    colors: { surface: '#ffffff', primary: '#e8590c', bgPage: '#f3f4f6', groupBg: '#ffffff', groupOutline: '#dfe1e6' },
    sizes: { density: 'default', pagePadding: '12px', groupGap: '12px', groupBorderRadius: '8px', widgetGap: '12px' }
})
add({
    id: PAGE, type: 'ui-page', name: 'Impressora 3D', ui: BASE, path: '/impressora-3d', icon: 'printer-3d',
    layout: 'grid', theme: THEME,
    breakpoints: [
        { name: 'Default', px: '0', cols: '3' }, { name: 'Tablet', px: '576', cols: '6' },
        { name: 'Small Desktop', px: '768', cols: '9' }, { name: 'Desktop', px: '1024', cols: '12' }
    ],
    tabs: [], order: 1, className: '', visible: 'true', disabled: 'false'
})

const GRUPOS = [
    ['status', 'Status da impressão', 6],
    ['camera', 'Câmera', 6],
    ['temps', 'Temperaturas', 6],
    ['ams', 'Filamentos (AMS)', 6],
    ['controle', 'Controle', 4],
    ['movimento', 'Movimento', 4],
    ['ajustes', 'Ajustes ao vivo', 4],
    ['grafico', 'Histórico de temperatura', 6],
    ['console', 'Console G-code', 6],
    ['arquivos', 'Arquivos', 6],
    ['sistema', 'Sistema', 6],
    ['historico', 'Histórico de impressões', 12],
    ['config', 'Configuração', 12]
]
const G = {}
GRUPOS.forEach(([k, nome, w], i) => {
    G[k] = id('grupo:' + k)
    add({
        id: G[k], type: 'ui-group', name: nome, page: PAGE, width: String(w), height: '1', order: i + 1,
        showTitle: true, className: '', visible: 'true', disabled: 'false', groupType: 'default'
    })
})

// ---------------------------------------------------------------- fluxo
add({
    id: TAB, type: 'tab', label: 'Impressora 3D', disabled: false,
    info: 'Aba "Impressora 3D" do Dashboard 2.\n\nConfigure o endereço da impressora no nó **⚙️ Configuração** ou no grupo **Configuração** do dashboard.\n\nCompatível com Klipper (Moonraker) e OctoPrint. Veja o README no repositório.'
})

const fn = (nome, arquivo, x, y, outputs, wires, extra) => add(Object.assign({
    id: id('fn:' + nome), type: 'function', z: TAB, name: nome, func: ler('funcoes', arquivo),
    outputs, timeout: 0, noerr: 0, initialize: '', finalize: '', libs: [], x, y, wires
}, extra || {}))

const tela = (chave, nome, arquivo, grupo, ordem, x, y, wires) => add({
    id: id('tela:' + chave), type: 'ui-template', z: TAB, group: G[grupo], page: '', ui: '', name: nome,
    order: ordem, width: '0', height: '0', head: '', format: ler('telas', arquivo), storeOutMessages: true,
    passthru: false, resendOnRefresh: true, templateScope: 'local', className: '', x, y, wires: [wires || []]
})

const comment = (nome, info, x, y) => add({ id: id('c:' + nome), type: 'comment', z: TAB, name: nome, info, x, y, wires: [] })

const inject = (nome, topic, repeat, onceDelay, x, y, wires) => add({
    id: id('inj:' + nome), type: 'inject', z: TAB, name: nome, props: [{ p: 'topic', vt: 'str' }],
    repeat, crontab: '', once: true, onceDelay, topic, x, y, wires: [wires]
})

const httpReq = (nome, ret, senderr, x, y, wires) => add({
    id: id('http:' + nome), type: 'http request', z: TAB, name: nome, method: 'use', ret, paytoqs: 'ignore',
    url: '', tls: '', persist: false, proxy: '', insecureHTTPParser: false, authType: '', senderr,
    headers: [], x, y, wires: [wires]
})

// IDs usados nas ligações
const I = {
    cfg: id('fn:⚙️ Configuração'), rap: id('fn:Consultas rápidas'), len: id('fn:Consultas lentas'),
    api: id('http:API da impressora'), interp: id('fn:Interpretar respostas'), cmd: id('fn:Comandos'),
    graf: id('fn:Séries do gráfico'), chart: id('chart'), gBico: id('gauge:bico'), gMesa: id('gauge:mesa'),
    notif: id('notificacao'), alertasOut: id('link:alertas'), alertasDbg: id('dbg:alertas'),
    linkCmdOut: id('link:cmd-out'), linkCmdIn: id('link:cmd-in'),
    tStatus: id('tela:status'), tCamera: id('tela:camera'), tTemps: id('tela:temps'), tControle: id('tela:controle'),
    tMov: id('tela:movimento'), tAjustes: id('tela:ajustes'), tArquivos: id('tela:arquivos'), tConsole: id('tela:console'),
    tHist: id('tela:historico'), tSis: id('tela:sistema'), tCfg: id('tela:config'), tAms: id('tela:ams'),
    broker: id('mqtt:broker'), mqttIn: id('mqtt:in'), mqttOut: id('mqtt:out'), mqttStatus: id('mqtt:status'),
    camBambu: id('fn:Câmera Bambu')
}

comment('Impressora 3D: leia-me', [
    'Monitora e controla uma impressora 3D (Klipper/Moonraker ou OctoPrint) no Dashboard 2.',
    '',
    '1. Abra o nó "⚙️ Configuração" e preencha `url` (e `apiKey`, se precisar), ou use o grupo Configuração do dashboard.',
    '2. Faça Deploy e abra /dashboard/impressora-3d.',
    '3. Para receber avisos no celular, ligue o nó "Alertas da impressora 3D" a um nó de Telegram, e-mail, push etc.'
].join('\n'), 170, 40)

// --- configuração
comment('1 · Configuração', '', 130, 100)
inject('Iniciar', 'iniciar', '', 0.3, 130, 140, [I.cfg])
fn('⚙️ Configuração', 'configuracao.js', 340, 160, 3, [[I.tCfg], [I.len], [I.interp]])
tela('config', 'Tela: Configuração', 'configuracao.vue', 'config', 1, 360, 220, [I.cfg])

// --- consultas
comment('2 · Leitura da impressora', '', 150, 300)
inject('A cada 2 s', 'tick', '2', 1, 140, 340, [I.rap])
inject('A cada 30 s', 'tick', '30', 1.5, 140, 400, [I.len])
fn('Consultas rápidas', 'consultas-rapidas.js', 340, 340, 2, [[I.api], [I.interp]])
fn('Consultas lentas', 'consultas-lentas.js', 340, 400, 3, [[I.api], [I.mqttIn], [I.mqttOut]], {
    outputLabels: ['requisições HTTP', 'conexão MQTT (Bambu)', 'publicar MQTT (Bambu)']
})

// --- Bambu Lab (MQTT local com TLS). O endereço e a senha vêm do dashboard.
add({
    id: I.broker, type: 'mqtt-broker', name: 'Bambu Lab (configurado pelo dashboard)', broker: 'localhost', port: '8883',
    tls: '', clientid: '', autoConnect: false, usetls: true, verifyservercert: false, protocolVersion: '4', keepalive: '30',
    cleansession: true, autoUnsubscribe: true, birthTopic: '', birthQos: '0', birthRetain: 'false', birthPayload: '', birthMsg: {},
    closeTopic: '', closeQos: '0', closeRetain: 'false', closePayload: '', closeMsg: {}, willTopic: '', willQos: '0',
    willRetain: 'false', willPayload: '', willMsg: {}, userProps: '', sessionExpiry: ''
})
comment('Bambu Lab: MQTT na porta 8883', 'Usuário bblp, senha = código de acesso. A conexão é feita pelo nó "Consultas lentas" com os dados salvos no dashboard (não precisa editar o nó MQTT).', 150, 470)
add({ id: I.mqttIn, type: 'mqtt in', z: TAB, name: 'Relatórios da Bambu', topic: '', qos: '0', datatype: 'json', broker: I.broker, nl: false, rap: true, rh: 0, inputs: 1, x: 580, y: 500, wires: [[I.interp]] })
add({ id: I.mqttOut, type: 'mqtt out', z: TAB, name: 'Comandos para a Bambu', topic: '', qos: '0', retain: 'false', respTopic: '', contentType: '', userProps: '', correl: '', expiry: '', broker: I.broker, x: 1000, y: 500, wires: [] })
add({ id: I.mqttStatus, type: 'status', z: TAB, name: 'Conexão MQTT', scope: [I.mqttIn], x: 570, y: 540, wires: [[I.interp]] })
httpReq('API da impressora', 'obj', true, 560, 380, [I.interp])
add({ id: id('catch:api'), type: 'catch', z: TAB, name: 'Erros da API', scope: [I.api], uncaught: false, x: 560, y: 440, wires: [[I.interp]] })

fn('Interpretar respostas', 'interpretar.js', 800, 400, 8, [
    [I.tStatus, I.tCamera, I.tTemps, I.tAms, I.tControle, I.tMov, I.tAjustes, I.gBico, I.gMesa, I.graf],
    [I.tArquivos],
    [I.tHist],
    [I.tSis],
    [I.tConsole],
    [I.notif, I.alertasOut, I.alertasDbg],
    [I.api],
    [I.notif],
    [I.mqttOut]
], {
    outputLabels: ['estado', 'arquivos', 'histórico', 'sistema', 'console', 'alertas', 'novas consultas', 'avisos de comandos', 'MQTT (Bambu)']
})

// --- telas
comment('3 · Telas do dashboard', '', 1090, 100)
tela('status', 'Tela: Status', 'status.vue', 'status', 1, 1110, 140)
tela('camera', 'Tela: Câmera', 'camera.vue', 'camera', 1, 1110, 180)
add({
    id: I.gBico, type: 'ui-gauge', z: TAB, name: 'Bico', group: G.temps, order: 1, width: '3', height: '3',
    gtype: 'gauge-half', gstyle: 'rounded', title: 'Bico', alwaysShowTitle: false, floatingTitlePosition: 'top-left',
    units: '°C', icon: 'mdi-printer-3d-nozzle', prefix: '', suffix: '',
    segments: [{ from: '0', color: '#4dabf7' }, { from: '50', color: '#fab005' }, { from: '170', color: '#fd7e14' }, { from: '260', color: '#e03131' }],
    min: '0', max: '300', sizeThickness: 16, sizeGap: 4, sizeKeyThickness: 8, styleRounded: true, styleGlow: false,
    value: 'payload.bico.atual', valueType: 'msg', className: '', x: 1090, y: 220, wires: [[]]
})
add({
    id: I.gMesa, type: 'ui-gauge', z: TAB, name: 'Mesa', group: G.temps, order: 2, width: '3', height: '3',
    gtype: 'gauge-half', gstyle: 'rounded', title: 'Mesa', alwaysShowTitle: false, floatingTitlePosition: 'top-left',
    units: '°C', icon: 'mdi-radiator', prefix: '', suffix: '',
    segments: [{ from: '0', color: '#4dabf7' }, { from: '40', color: '#fab005' }, { from: '70', color: '#fd7e14' }, { from: '100', color: '#e03131' }],
    min: '0', max: '120', sizeThickness: 16, sizeGap: 4, sizeKeyThickness: 8, styleRounded: true, styleGlow: false,
    value: 'payload.mesa.atual', valueType: 'msg', className: '', x: 1090, y: 260, wires: [[]]
})
tela('temps', 'Tela: Temperaturas', 'temperaturas.vue', 'temps', 3, 1130, 300, [I.linkCmdOut])
fn('Séries do gráfico', 'grafico.js', 1120, 340, 1, [[I.chart]])
add({
    id: I.chart, type: 'ui-chart', z: TAB, group: G.grafico, name: 'Gráfico de temperatura', label: 'Últimos 30 minutos',
    order: 1, chartType: 'line', category: 'topic', categoryType: 'msg', xAxisLabel: '', xAxisProperty: '',
    xAxisPropertyType: 'timestamp', xAxisType: 'time', xAxisFormat: '', xAxisFormatType: 'auto', xmin: '', xmax: '',
    yAxisLabel: '°C', yAxisProperty: 'payload', yAxisPropertyType: 'msg', ymin: '0', ymax: '', bins: 10,
    action: 'append', stackSeries: false, pointShape: 'false', pointRadius: 0, showLegend: true,
    removeOlder: '30', removeOlderUnit: '60', removeOlderPoints: '',
    colors: ['#e8590c', '#ffa94d', '#1c7ed6', '#74c0fc', '#2f9e44', '#ae3ec9', '#f03e3e', '#868e96', '#fcc419'],
    textColor: ['#666666'], textColorDefault: true, gridColor: ['#e5e5e5'], gridColorDefault: true,
    width: '6', height: '6', className: '', interpolation: 'linear', x: 1330, y: 340, wires: [[]]
})
tela('ams', 'Tela: AMS', 'ams.vue', 'ams', 1, 1100, 700, [I.linkCmdOut])
tela('controle', 'Tela: Controle', 'controle.vue', 'controle', 1, 1110, 380, [I.linkCmdOut])
tela('movimento', 'Tela: Movimento', 'movimento.vue', 'movimento', 1, 1120, 420, [I.linkCmdOut])
tela('ajustes', 'Tela: Ajustes ao vivo', 'ajustes.vue', 'ajustes', 1, 1130, 460, [I.linkCmdOut])
tela('arquivos', 'Tela: Arquivos', 'arquivos.vue', 'arquivos', 1, 1110, 500, [I.linkCmdOut])
tela('historico', 'Tela: Histórico', 'historico.vue', 'historico', 1, 1120, 540, [I.linkCmdOut])
tela('sistema', 'Tela: Sistema', 'sistema.vue', 'sistema', 1, 1110, 580)
tela('console', 'Tela: Console', 'console.vue', 'console', 1, 1110, 620, [I.linkCmdOut])
add({
    id: id('estilo'), type: 'ui-template', z: TAB, group: '', page: PAGE, ui: '', name: 'Estilo da página',
    order: 0, width: 0, height: 0, head: '', format: ler('telas', 'estilo.css'), storeOutMessages: true,
    passthru: true, resendOnRefresh: true, templateScope: 'page:style', className: '', x: 1120, y: 660, wires: [[]]
})
add({ id: I.linkCmdOut, type: 'link out', z: TAB, name: 'para Comandos', mode: 'link', links: [I.linkCmdIn], x: 1365, y: 460, wires: [] })

// --- alertas
add({
    id: I.notif, type: 'ui-notification', z: TAB, ui: BASE, position: 'top right', colorDefault: true, color: '#000000',
    displayTime: '6', showCountdown: true, outputs: 0, allowDismiss: true, dismissText: 'Fechar', allowConfirm: false,
    confirmText: 'Confirmar', raw: false, className: '', name: 'Avisos na tela', x: 1110, y: 780, wires: []
})
add({ id: I.alertasOut, type: 'link out', z: TAB, name: 'Alertas da impressora 3D', mode: 'link', links: [], x: 1165, y: 820, wires: [] })
add({
    id: I.alertasDbg, type: 'debug', z: TAB, name: 'Ver alertas', active: false, tosidebar: true, console: false, tostatus: false,
    complete: 'alerta', targetType: 'msg', statusVal: '', statusType: 'auto', x: 1110, y: 860, wires: []
})
comment('Alertas: ligue a um nó de Telegram, e-mail, push…', [
    'O link "Alertas da impressora 3D" recebe uma mensagem a cada evento:',
    'impressão iniciada, pausada, retomada, 50%, 90%, concluída, cancelada, erro,',
    'bico/mesa aquecidos e conexão perdida/restabelecida.',
    '',
    '- msg.payload: texto pronto (ex.: "✅ Impressão concluída — caneca em 2h 10min")',
    '- msg.topic: título',
    '- msg.alerta: { nivel, titulo, texto, impressora, estado, arquivo, progresso, em }'
].join('\n'), 1420, 820)

// --- comandos
comment('4 · Comandos dos botões', '', 140, 580)
add({ id: I.linkCmdIn, type: 'link in', z: TAB, name: 'Comandos', links: [I.linkCmdOut], x: 145, y: 600, wires: [[I.cmd]] })
fn('Comandos', 'comandos.js', 340, 600, 5, [[I.api], [I.len], [I.notif], [I.interp], [I.mqttOut]], {
    outputLabels: ['requisição', 'recarregar listas', 'aviso', 'console', 'MQTT (Bambu)']
})

// --- proxy de imagens
comment('5 · Câmera e miniatura (o navegador busca pelo Node-RED)', '', 250, 680)
const httpIn = (nome, url, x, y, wires) => add({ id: id('in:' + nome), type: 'http in', z: TAB, name: nome, url, method: 'get', upload: false, swaggerDoc: '', x, y, wires: [wires] })
const httpRes = (nome, x, y) => add({ id: id('res:' + nome), type: 'http response', z: TAB, name: '', statusCode: '', headers: {}, x, y, wires: [] })

httpIn('GET câmera', '/impressora3d/webcam', 150, 700, [id('fn:Foto da câmera')])
fn('Foto da câmera', 'camera-url.js', 360, 700, 3, [[id('http:Buscar foto')], [id('fn:Responder foto')], [I.camBambu]])
fn('Câmera Bambu', 'camera-bambu.js', 560, 740, 1, [[id('fn:Responder foto')]], {
    libs: [{ var: 'tls', module: 'tls' }],
    finalize: "const c = context.get('cam');\nif (c && c.sock) c.sock.destroy();\n"
})
httpReq('Buscar foto', 'bin', false, 560, 700, [id('fn:Responder foto')])
fn('Responder foto', 'responder-imagem.js', 760, 700, 1, [[id('res:foto')]])
httpRes('foto', 930, 700)

httpIn('GET miniatura', '/impressora3d/miniatura', 150, 800, [id('fn:Miniatura do arquivo')])
fn('Miniatura do arquivo', 'miniatura-url.js', 370, 800, 2, [[id('http:Buscar miniatura')], [id('fn:Responder miniatura')]])
httpReq('Buscar miniatura', 'bin', false, 580, 800, [id('fn:Responder miniatura')])
fn('Responder miniatura', 'responder-imagem.js', 780, 800, 1, [[id('res:miniatura')]])
httpRes('miniatura', 950, 800)
add({ id: id('catch:img'), type: 'catch', z: TAB, name: 'Silenciar erros de imagem', scope: [id('http:Buscar foto'), id('http:Buscar miniatura')], uncaught: false, x: 600, y: 860, wires: [[]] })

// Configuração e dashboard primeiro, depois a aba e os nós
const ordem = { tab: 0 }
nodes.sort((a, b) => (a.z ? 1 : 0) - (b.z ? 1 : 0) || (ordem[a.type] ?? 1) - (ordem[b.type] ?? 1))

// Confere ligações quebradas
const ids = new Set(nodes.map(n => n.id))
for (const n of nodes) for (const w of (n.wires || []).flat()) if (!ids.has(w)) throw new Error(`Ligação quebrada em "${n.name || n.type}": ${w}`)

const destino = path.join(__dirname, 'impressora-3d.json')
fs.writeFileSync(destino, JSON.stringify(nodes, null, 2) + '\n')
console.log(`OK: ${nodes.length} nós → ${path.relative(process.cwd(), destino)}`)
