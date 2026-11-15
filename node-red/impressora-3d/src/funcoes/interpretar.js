// Interpreta as respostas da impressora (Moonraker ou OctoPrint) e monta um
// "estado" único, igual para os dois tipos, que alimenta todas as telas.
//
// Saídas:
//  1 estado      → status, câmera, temperaturas, controle, movimento, ajustes, gráfico
//  2 arquivos    → lista de arquivos
//  3 histórico   → histórico de impressões
//  4 sistema     → informações do sistema
//  5 console     → console G-code
//  6 alertas     → notificação na tela + link "Alertas da impressora 3D"
//  7 requisições → novas consultas (metadados do arquivo em impressão)
//  8 avisos      → resultado de comandos (erros, confirmações)

const cfg = flow.get('cfg') || {};
const out = [null, null, null, null, null, null, null, null];
const alertas = [];
const pedidos = [];

const novo = () => ({
    mk: {}, octo: {}, meta: {}, metaPedido: {}, arquivos: null, hist: null, totais: null,
    sis: {}, console: [], consoleT: null, consoleLocal: [], estadoAnt: null, marcos: {},
    aquecendo: {}, online: null, erroConexao: '', latencia: null
});
let m = context.get('m') || novo();

// ---------- utilidades ----------
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
const r1 = v => (num(v) === null ? null : Math.round(v * 10) / 10);
const nomeCurto = a => (a || '').split('/').pop().replace(/\.(gcode|gco|g|bgcode)$/i, '');
const dur = s => {
    if (num(s) === null) return '';
    s = Math.round(s);
    const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${String(mi).padStart(2, '0')}min` : `${mi}min`;
};
function req(topic, caminho, extra) {
    const headers = {};
    if (cfg.apiKey) headers['X-Api-Key'] = cfg.apiKey;
    return Object.assign({
        topic, url: cfg.url + caminho, method: 'GET', headers,
        requestTimeout: 8000, enviadoEm: Date.now(), payload: ''
    }, extra || {});
}
function textoErro(r) {
    const p = r.payload;
    if (p && typeof p === 'object') {
        if (p.error && typeof p.error === 'object') return p.error.message || JSON.stringify(p.error);
        if (p.error) return String(p.error);
        if (p.message) return String(p.message);
    }
    if (typeof p === 'string' && p.trim()) return p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (r.error) return r.error.message || String(r.error);
    return 'HTTP ' + r.statusCode;
}
// Converte endereços relativos/locais da câmera para o endereço da impressora
function resolverUrl(u) {
    if (!u || !cfg.url) return '';
    const mt = cfg.url.match(/^(https?:)\/\/([^/:]+)(:\d+)?/i);
    if (!mt) return u;
    const proto = mt[1], host = mt[2], porta = mt[3] || '';
    if (/^https?:\/\//i.test(u)) return u.replace(/\/\/(127\.0\.0\.1|localhost)(?=[:/])/i, '//' + host);
    const p = porta === ':7125' ? '' : porta; // a câmera fica na interface web (porta 80), não na API
    return proto + '//' + host + p + (u.startsWith('/') ? u : '/' + u);
}
function alerta(nivel, titulo, texto) {
    const icones = { sucesso: '✅', info: 'ℹ️', aviso: '⏸️', erro: '⚠️' };
    alertas.push({ nivel, titulo, texto: texto || '', icone: icones[nivel] || '' });
}

// ---------- conexão ----------
function marcarOnline(r) {
    if (m.online === false) alerta('sucesso', 'Impressora conectada novamente', cfg.nome);
    m.online = true;
    m.erroConexao = '';
    if (r && r.enviadoEm) m.latencia = Date.now() - r.enviadoEm;
}
function textoConexao(r) {
    const t = textoErro(r);
    if (/ECONNREFUSED/.test(t)) return 'A impressora recusou a conexão: confira o endereço e a porta, ou se o Moonraker/OctoPrint está ligado.';
    if (/ETIMEDOUT|ESOCKETTIMEDOUT|no response|sem resposta|timeout/i.test(t)) return 'A impressora não respondeu: pode estar desligada ou fora da rede.';
    if (/ENOTFOUND|EAI_AGAIN/.test(t)) return 'Endereço não encontrado: confira o nome/IP da impressora.';
    if (/EHOSTUNREACH|ENETUNREACH/.test(t)) return 'Rede inalcançável: o Node-RED não enxerga a impressora.';
    return t;
}
function marcarOffline(r) {
    const texto = textoConexao(r);
    if (m.online === true) alerta('erro', 'Conexão com a impressora perdida', texto);
    m.online = false;
    m.erroConexao = texto;
}

// ---------- câmera e configuração pública ----------
function cfgPublica() {
    const auto = flow.get('webcamAuto') || {};
    const snapshot = cfg.webcamSnapshot || auto.snapshot || resolverUrl('/webcam/?action=snapshot');
    const stream = cfg.webcamStream || auto.stream || resolverUrl('/webcam/?action=stream');
    flow.set('webcamSnapshotUrl', snapshot);
    return {
        nome: cfg.nome, tipo: cfg.tipo, temUrl: !!cfg.url,
        webcamModo: cfg.webcamModo, webcamIntervalo: cfg.webcamIntervalo, webcamStream: stream,
        bicoMax: cfg.bicoMax, mesaMax: cfg.mesaMax, presets: cfg.presets || []
    };
}

// ---------- estado: Moonraker ----------
function estadoMk() {
    const s = m.mk.status;
    if (!s) {
        return {
            estado: 'erro', estadoTexto: 'Klipper indisponível',
            mensagem: m.mk.erroKlippy || 'O Moonraker respondeu, mas o Klipper não está pronto.'
        };
    }
    const wh = s.webhooks || {}, ps = s.print_stats || {}, vs = s.virtual_sdcard || {};
    const ds = s.display_status || {}, ex = s.extruder || {}, hb = s.heater_bed || {};
    const th = s.toolhead || {}, gm = s.gcode_move || {}, mr = s.motion_report || {}, fan = s.fan || {};
    const MAPA = {
        standby: ['pronta', 'Pronta'], printing: ['imprimindo', 'Imprimindo'], paused: ['pausada', 'Pausada'],
        complete: ['concluida', 'Concluída'], cancelled: ['cancelada', 'Cancelada'], error: ['erro', 'Erro']
    };
    let [estado, estadoTexto] = MAPA[ps.state] || ['pronta', 'Pronta'];
    if (wh.state && wh.state !== 'ready') {
        estado = wh.state === 'startup' ? 'iniciando' : 'erro';
        estadoTexto = wh.state === 'startup' ? 'Klipper iniciando' : 'Klipper: ' + wh.state;
    }
    const ativo = estado === 'imprimindo' || estado === 'pausada';
    const arquivo = ps.filename || '';
    const meta = arquivo ? m.meta[arquivo] : null;
    if (arquivo && !m.metaPedido[arquivo]) {
        m.metaPedido[arquivo] = true;
        pedidos.push(req('mk:metadata', '/server/files/metadata?filename=' + encodeURIComponent(arquivo), { arquivo }));
    }

    const progresso = Math.min(100, ((ds.progress || vs.progress || 0) * 100));
    const decorrido = num(ps.print_duration) || 0;
    let restante = null;
    if (ativo) {
        const porArquivo = progresso > 0.5 ? decorrido / (progresso / 100) - decorrido : null;
        const porSlicer = meta && meta.estimated_time ? Math.max(0, meta.estimated_time - decorrido) : null;
        if (porArquivo !== null && porSlicer !== null) restante = progresso > 5 ? (porArquivo + porSlicer) / 2 : porSlicer;
        else restante = porArquivo !== null ? porArquivo : porSlicer;
    }

    // camadas: usa SET_PRINT_STATS_INFO se o fatiador mandar; senão calcula pela altura Z
    const info = ps.info || {};
    let camada = num(info.current_layer), camadas = num(info.total_layer);
    const zAtual = gm.gcode_position ? gm.gcode_position[2] : null;
    if (meta && meta.layer_height) {
        const primeira = meta.first_layer_height || meta.layer_height;
        if (!camadas && meta.object_height) camadas = Math.ceil((meta.object_height - primeira) / meta.layer_height + 1);
        if (camada === null && ativo && num(zAtual) !== null) {
            camada = zAtual <= primeira + 0.001 ? 1 : Math.ceil((zAtual - primeira) / meta.layer_height + 1);
            if (camadas) camada = Math.min(camada, camadas);
        }
    }

    const pos = mr.live_position || th.position || [];
    const sensores = (flow.get('mkSensores') || []).filter(n => s[n]).map(n => ({
        nome: n.replace(/^(temperature_sensor|temperature_fan|heater_generic)\s+/, '').replace(/_/g, ' '),
        atual: r1(s[n].temperature), alvo: num(s[n].target)
    }));

    let miniatura = null;
    if (meta && Array.isArray(meta.thumbnails) && meta.thumbnails.length) {
        const t = meta.thumbnails.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0];
        const pasta = arquivo.includes('/') ? arquivo.slice(0, arquivo.lastIndexOf('/') + 1) : '';
        flow.set('miniaturaUrl', cfg.url + '/server/files/gcodes/' + encodeURI(pasta + t.relative_path));
        miniatura = arquivo + '@' + (meta.modified || '');
    }

    const filUsado = num(ps.filament_used);
    const filTotal = meta ? num(meta.filament_total) : null;
    const pesoTotal = meta ? num(meta.filament_weight_total) : null;
    const vazao = num(mr.live_extruder_velocity) !== null ? mr.live_extruder_velocity * Math.PI * Math.pow((ex.filament_diameter || 1.75) / 2, 2) : null;

    return {
        estado, estadoTexto,
        mensagem: ps.message || ds.message || (wh.state !== 'ready' ? wh.state_message : '') || '',
        arquivo, nome: nomeCurto(arquivo), miniatura,
        progresso: r1(progresso), decorrido, restante, total: ativo ? decorrido + (restante || 0) : decorrido,
        estimativaSlicer: meta ? num(meta.estimated_time) : null,
        eta: estado === 'imprimindo' && restante !== null ? Date.now() + restante * 1000 : null,
        camada, camadas,
        filamento: { usado: filUsado, total: filTotal, peso: pesoTotal, pesoUsado: pesoTotal && filTotal && filUsado !== null ? pesoTotal * filUsado / filTotal : null },
        bico: { atual: r1(ex.temperature), alvo: num(ex.target), potencia: num(ex.power) !== null ? Math.round(ex.power * 100) : null, podeExtrudar: ex.can_extrude },
        mesa: { atual: r1(hb.temperature), alvo: num(hb.target), potencia: num(hb.power) !== null ? Math.round(hb.power * 100) : null },
        sensores,
        posicao: pos.length >= 3 ? { x: r1(pos[0]), y: r1(pos[1]), z: Math.round(pos[2] * 100) / 100 } : null,
        homed: th.homed_axes || '',
        ventoinha: num(fan.speed) !== null ? Math.round(fan.speed * 100) : null,
        velocidade: num(gm.speed_factor) !== null ? Math.round(gm.speed_factor * 100) : null,
        fluxo: num(gm.extrude_factor) !== null ? Math.round(gm.extrude_factor * 100) : null,
        zOffset: gm.homing_origin ? Math.round(gm.homing_origin[2] * 1000) / 1000 : null,
        velocidadeAtual: r1(mr.live_velocity),
        vazao: r1(vazao),
        limites: th.axis_maximum ? { x: th.axis_maximum[0], y: th.axis_maximum[1], z: th.axis_maximum[2] } : null
    };
}

// ---------- estado: OctoPrint ----------
function estadoOcto() {
    const p = m.octo.printer, j = m.octo.job || {};
    const job = j.job || {}, prog = j.progress || {}, file = job.file || {};
    const arquivo = file.path || file.name || '';
    const meta = arquivo ? m.meta[arquivo] : null;
    if (arquivo && !m.metaPedido[arquivo]) {
        m.metaPedido[arquivo] = true;
        pedidos.push(req('octo:metadata', '/api/files/' + (file.origin || 'local') + '/' + arquivo.split('/').map(encodeURIComponent).join('/'), { arquivo }));
    }
    if (m.octo.desconectada || !p) {
        return {
            estado: 'desconectada', estadoTexto: 'Impressora desconectada', arquivo, nome: nomeCurto(arquivo),
            mensagem: 'O OctoPrint está online, mas não está ligado à impressora. Use "Reconectar" em Controle.'
        };
    }
    const f = (p.state && p.state.flags) || {};
    let estado = 'pronta', estadoTexto = 'Pronta';
    if (f.cancelling) [estado, estadoTexto] = ['cancelando', 'Cancelando'];
    else if (f.pausing) [estado, estadoTexto] = ['pausando', 'Pausando'];
    else if (f.paused) [estado, estadoTexto] = ['pausada', 'Pausada'];
    else if (f.printing) [estado, estadoTexto] = ['imprimindo', 'Imprimindo'];
    else if (f.error || f.closedOrError) [estado, estadoTexto] = ['erro', 'Erro'];
    else if (arquivo && num(prog.completion) >= 99.9) [estado, estadoTexto] = ['concluida', 'Concluída'];
    const ativo = ['imprimindo', 'pausada', 'pausando'].includes(estado);

    const t = p.temperature || {};
    const sensores = Object.keys(t).filter(k => k !== 'tool0' && k !== 'bed' && t[k] && typeof t[k] === 'object')
        .map(k => ({ nome: k === 'chamber' ? 'câmara' : k, atual: r1(t[k].actual), alvo: num(t[k].target) }));
    const filTotal = job.filament && job.filament.tool0 ? num(job.filament.tool0.length) : null;
    const progresso = num(prog.completion) || 0;
    const restante = ativo ? num(prog.printTimeLeft) : null;

    let miniatura = null;
    if (meta && meta.thumbnail) {
        flow.set('miniaturaUrl', cfg.url + '/' + meta.thumbnail.replace(/^\/+/, ''));
        miniatura = arquivo + '@' + (meta.date || '');
    }
    const analise = (meta && meta.gcodeAnalysis) || {};

    return {
        estado, estadoTexto,
        mensagem: (p.state && p.state.error) || '',
        arquivo, nome: nomeCurto(file.display || arquivo), miniatura,
        progresso: r1(progresso), decorrido: num(prog.printTime) || 0, restante,
        total: ativo ? (num(prog.printTime) || 0) + (restante || 0) : num(prog.printTime),
        estimativaSlicer: num(job.estimatedPrintTime) || num(analise.estimatedPrintTime),
        eta: estado === 'imprimindo' && restante !== null ? Date.now() + restante * 1000 : null,
        camada: null, camadas: null,
        filamento: { usado: filTotal !== null ? filTotal * progresso / 100 : null, total: filTotal, peso: null, pesoUsado: null },
        bico: { atual: t.tool0 ? r1(t.tool0.actual) : null, alvo: t.tool0 ? num(t.tool0.target) : null, potencia: null },
        mesa: { atual: t.bed ? r1(t.bed.actual) : null, alvo: t.bed ? num(t.bed.target) : null, potencia: null },
        sensores,
        posicao: null, homed: '', ventoinha: null, velocidade: null, fluxo: null, zOffset: null,
        velocidadeAtual: null, vazao: null, limites: null
    };
}

function montarEstado() {
    const base = {
        cfg: cfgPublica(), online: m.online, tipo: cfg.tipo, atualizadoEm: Date.now(), latencia: m.latencia,
        bico: { atual: null, alvo: null, potencia: null }, mesa: { atual: null, alvo: null, potencia: null }, sensores: []
    };
    if (!cfg.url) return { ...base, estado: 'semconfig', estadoTexto: 'Não configurada', mensagem: 'Informe o endereço da impressora no grupo "Configuração", no fim da página.' };
    if (m.online === null) return { ...base, estado: 'conectando', estadoTexto: 'Conectando…' };
    if (m.online === false) return { ...base, estado: 'offline', estadoTexto: 'Sem conexão', mensagem: m.erroConexao };
    return { ...base, ...(cfg.tipo === 'octoprint' ? estadoOcto() : estadoMk()) };
}

function verificarAlertas(e) {
    const ant = m.estadoAnt;
    m.estadoAnt = { estado: e.estado, arquivo: e.arquivo };
    if (!ant || ['offline', 'conectando', 'semconfig'].includes(ant.estado) || ['offline', 'conectando', 'semconfig'].includes(e.estado)) return;
    const de = ant.estado, para = e.estado, nome = e.nome || '';
    if (de !== para) {
        if (para === 'imprimindo') {
            if (de === 'pausada' || de === 'pausando') alerta('info', 'Impressão retomada', nome);
            else { alerta('info', 'Impressão iniciada', nome + (e.estimativaSlicer ? ' · estimativa ' + dur(e.estimativaSlicer) : '')); m.marcos[e.arquivo] = {}; }
        } else if (para === 'pausada') alerta('aviso', 'Impressão pausada', nome);
        else if (para === 'concluida' || (de === 'imprimindo' && para === 'pronta' && e.progresso >= 99)) alerta('sucesso', 'Impressão concluída', nome + (e.decorrido ? ' em ' + dur(e.decorrido) : ''));
        else if (para === 'cancelada' || (de === 'cancelando' && para === 'pronta')) alerta('aviso', 'Impressão cancelada', nome);
        else if (para === 'erro') alerta('erro', 'Erro na impressora', e.mensagem);
        else if (para === 'desconectada') alerta('erro', 'Impressora desconectada do OctoPrint', '');
    }
    if (para === 'imprimindo' && e.arquivo) {
        let mk = m.marcos[e.arquivo];
        if (!mk) { // começou a acompanhar no meio da impressão: não avisa marcos já passados
            mk = m.marcos[e.arquivo] = {};
            for (const p of [50, 90]) if (e.progresso >= p) mk[p] = true;
        }
        for (const p of [50, 90]) {
            if (e.progresso >= p && !mk[p]) {
                mk[p] = true;
                alerta('info', `Impressão em ${p}%`, nome + (e.restante ? ' · faltam ' + dur(e.restante) : ''));
            }
        }
    }
    for (const [k, rot] of [['bico', 'Bico'], ['mesa', 'Mesa']]) {
        const h = e[k];
        if (!h || num(h.alvo) === null || num(h.atual) === null) continue;
        if (h.alvo <= 0) { m.aquecendo[k] = false; continue; }
        const dif = Math.abs(h.atual - h.alvo);
        if (dif > 5) m.aquecendo[k] = true;
        else if (m.aquecendo[k] && dif <= 2) { m.aquecendo[k] = false; alerta('info', `${rot} aquecido`, `${h.atual} °C (alvo ${h.alvo} °C)`); }
    }
}

// ---------- listas ----------
function emitirHistorico() {
    out[2] = { topic: 'historico', payload: { suportado: cfg.tipo !== 'octoprint', jobs: m.hist || [], totais: m.totais } };
}
function emitirSistema() {
    out[3] = { topic: 'sistema', payload: { tipo: cfg.tipo, online: m.online, latencia: m.latencia, ...m.sis } };
}
function emitirConsole() {
    const linhas = cfg.tipo === 'octoprint' ? m.consoleLocal : m.console;
    out[4] = { topic: 'console', payload: { linhas: linhas.slice(-150), suportaRespostas: cfg.tipo !== 'octoprint' } };
}
function addConsoleLocal(tipo, texto) {
    m.consoleLocal.push({ t: Date.now(), tipo, texto });
    if (m.consoleLocal.length > 150) m.consoleLocal = m.consoleLocal.slice(-150);
}
function achatarOcto(itens, lista) {
    for (const it of itens || []) {
        if (it.type === 'folder') achatarOcto(it.children, lista);
        else if (it.type === 'machinecode') {
            lista.push({
                caminho: it.path, nome: it.display || it.name, pasta: it.path.includes('/') ? it.path.slice(0, it.path.lastIndexOf('/')) : '',
                tamanho: it.size || 0, modificado: (it.date || 0) * 1000,
                estimativa: it.gcodeAnalysis ? num(it.gcodeAnalysis.estimatedPrintTime) : null,
                ultima: it.prints && it.prints.last ? (it.prints.last.success ? 'ok' : 'falhou') : null
            });
        }
    }
    return lista;
}

// ============================================================
//  Processa a mensagem recebida
// ============================================================
const t = msg.topic || '';
let emitir = false;

if (t === 'reset') {
    m = novo();
    flow.set('mkSensores', []);
    flow.set('miniaturaUrl', null);
    flow.set('webcamAuto', {});
    emitir = true;
    emitirHistorico(); emitirSistema(); emitirConsole();
    out[1] = { topic: 'arquivos', payload: { lista: [], tipo: cfg.tipo } };
} else if (t === 'semConfig') {
    m.online = null;
    emitir = true;
} else if (t === 'console:local') {
    addConsoleLocal(msg.tipo || 'cmd', msg.payload);
    emitirConsole();
} else if (t === 'console:limpar') {
    m.consoleCorte = typeof m.consoleT === 'number' ? m.consoleT : 0;
    m.console = []; m.consoleLocal = [];
    emitirConsole();
} else {
    const semConexao = !!msg.error && typeof msg.statusCode !== 'number';
    const ok = !msg.error && typeof msg.statusCode === 'number' && msg.statusCode < 400;
    const p = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
    const res = p.result;

    switch (t) {
        // ----- Moonraker -----
        case 'mk:status':
            if (semConexao) marcarOffline(msg);
            else if (!ok) { marcarOnline(msg); m.mk.status = null; m.mk.erroKlippy = textoErro(msg); }
            else { marcarOnline(msg); m.mk.status = res && res.status; m.mk.erroKlippy = null; }
            emitir = true;
            break;
        case 'mk:console':
            if (ok && res && Array.isArray(res.gcode_store)) {
                const g = res.gcode_store;
                const ultimo = g.length ? g[g.length - 1].time : 0;
                if (ultimo !== m.consoleT) {
                    const corte = m.consoleCorte || 0;
                    m.consoleT = ultimo;
                    m.console = g.filter(l => l.time > corte).map(l => ({
                        t: l.time * 1000,
                        tipo: l.type === 'command' ? 'cmd' : (/^!!/.test(l.message) ? 'erro' : 'resp'),
                        texto: String(l.message).replace(/^\/\/\s?/, '')
                    }));
                    emitirConsole();
                }
            }
            break;
        case 'mk:arquivos':
            if (ok && Array.isArray(res)) {
                m.arquivos = res.filter(f => /\.(gcode|gco|g|bgcode)$/i.test(f.path)).map(f => ({
                    caminho: f.path, nome: nomeCurto(f.path), pasta: f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '',
                    tamanho: f.size || 0, modificado: (f.modified || 0) * 1000, estimativa: null, ultima: null
                }));
                out[1] = { topic: 'arquivos', payload: { lista: m.arquivos, tipo: cfg.tipo } };
            }
            break;
        case 'mk:historico':
            if (ok && res && Array.isArray(res.jobs)) {
                m.hist = res.jobs.map(j => ({
                    id: j.job_id, arquivo: j.filename, nome: nomeCurto(j.filename), status: j.status,
                    inicio: j.start_time ? j.start_time * 1000 : null, fim: j.end_time ? j.end_time * 1000 : null,
                    duracao: num(j.print_duration), total: num(j.total_duration), filamento: num(j.filament_used),
                    existe: j.exists !== false
                }));
                emitirHistorico();
            }
            break;
        case 'mk:totais':
            if (ok && res && res.job_totals) {
                const jt = res.job_totals;
                m.totais = {
                    impressoes: jt.total_jobs, tempoTotal: jt.total_time, tempoImpressao: jt.total_print_time,
                    filamento: jt.total_filament_used, maiorImpressao: jt.longest_print
                };
                emitirHistorico();
            }
            break;
        case 'mk:proc':
            if (ok && res) {
                const mem = res.system_memory || {};
                m.sis.host = {
                    cpuTemp: r1(res.cpu_temp), cpu: res.system_cpu_usage ? r1(res.system_cpu_usage.cpu) : null,
                    memUsada: mem.used || (mem.total && mem.available ? mem.total - mem.available : null), memTotal: mem.total || null,
                    uptime: num(res.system_uptime), conexoes: num(res.websocket_connections)
                };
                emitirSistema();
            }
            break;
        case 'mk:printerinfo':
            if (ok && res) { m.sis.klipper = { estado: res.state, mensagem: res.state_message, hostname: res.hostname, versao: res.software_version }; emitirSistema(); }
            break;
        case 'mk:serverinfo':
            if (ok && res) { m.sis.moonraker = { versao: res.moonraker_version, klippy: res.klippy_state, avisos: res.warnings || [] }; emitirSistema(); }
            break;
        case 'mk:objetos':
            if (ok && res && Array.isArray(res.objects)) {
                flow.set('mkSensores', res.objects.filter(o => /^(temperature_sensor|temperature_fan|heater_generic) /.test(o)));
            }
            break;
        case 'mk:webcams':
            if (ok && res && Array.isArray(res.webcams) && res.webcams.length) {
                const w = res.webcams.find(c => c.enabled !== false) || res.webcams[0];
                flow.set('webcamAuto', { snapshot: resolverUrl(w.snapshot_url), stream: resolverUrl(w.stream_url) });
            }
            break;
        case 'mk:metadata':
        case 'octo:metadata':
            if (ok && msg.arquivo) {
                m.meta[msg.arquivo] = t === 'mk:metadata' ? res : p;
                const k = Object.keys(m.meta);
                if (k.length > 20) delete m.meta[k[0]];
                emitir = true;
            }
            break;

        // ----- OctoPrint -----
        case 'octo:printer':
            if (semConexao) marcarOffline(msg);
            else if (msg.statusCode === 409) { marcarOnline(msg); m.octo.desconectada = true; m.octo.printer = null; }
            else if (ok) { marcarOnline(msg); m.octo.desconectada = false; m.octo.printer = p; }
            else { marcarOnline(msg); m.octo.desconectada = true; m.octo.printer = null; }
            emitir = true;
            break;
        case 'octo:job':
            if (ok) m.octo.job = p;
            break;
        case 'octo:arquivos':
            if (ok) {
                m.arquivos = achatarOcto(p.files, []);
                out[1] = { topic: 'arquivos', payload: { lista: m.arquivos, tipo: cfg.tipo } };
            }
            if (!m.hist) { m.hist = []; emitirHistorico(); }
            break;
        case 'octo:versao':
            if (ok) { m.sis.octoprint = { versao: p.server, api: p.api, texto: p.text }; emitirSistema(); }
            break;
        case 'octo:conexao':
            if (ok && p.current) { m.sis.conexao = { estado: p.current.state, porta: p.current.port, baud: p.current.baudrate }; emitirSistema(); }
            break;
        case 'octo:settings':
            if (ok) {
                const w = p.webcam || {};
                const cw = (p.plugins && p.plugins.classicwebcam) || {};
                flow.set('webcamAuto', {
                    snapshot: resolverUrl(w.snapshotUrl || cw.snapshot || ''),
                    stream: resolverUrl(w.streamUrl || cw.stream || '')
                });
            }
            break;

        // ----- resultado de comandos -----
        case 'cmd':
            if (!ok) {
                const erro = textoErro(msg);
                out[7] = { topic: 'Comando falhou', payload: `⚠️ ${msg.descricao || 'Comando'} falhou: ${erro}` };
                if (cfg.tipo === 'octoprint' && msg.gcode) { addConsoleLocal('erro', '!! ' + erro); emitirConsole(); }
            } else {
                if (msg.avisarOk) out[7] = { topic: 'Comando', payload: '✔ ' + (msg.descricao || 'Comando enviado') };
                if (cfg.tipo === 'octoprint' && msg.gcode) { addConsoleLocal('resp', 'ok'); emitirConsole(); }
            }
            break;
    }
}

if (emitir) {
    const e = montarEstado();
    verificarAlertas(e);
    flow.set('estado', e);
    out[0] = { topic: 'estado', payload: e };
    node.status(e.estado === 'imprimindo'
        ? { fill: 'blue', shape: 'dot', text: `${e.estadoTexto} ${e.progresso}%` }
        : { fill: ['offline', 'erro', 'desconectada'].includes(e.estado) ? 'red' : (e.estado === 'semconfig' ? 'yellow' : 'green'), shape: 'dot', text: e.estadoTexto });
    // atualiza a lista de sistema quando a conexão muda
    if (!out[3] && (m.online !== m.onlineEmitido)) { m.onlineEmitido = m.online; emitirSistema(); }
}

if (alertas.length) {
    const e = flow.get('estado') || {};
    out[5] = alertas.map(a => ({
        topic: a.titulo,
        payload: `${a.icone} ${a.titulo}${a.texto ? ' — ' + a.texto : ''}`,
        alerta: { ...a, impressora: cfg.nome, estado: e.estado, arquivo: e.arquivo || '', progresso: e.progresso, em: new Date().toISOString() }
    }));
}
if (pedidos.length) out[6] = pedidos;

context.set('m', m);
return out;
