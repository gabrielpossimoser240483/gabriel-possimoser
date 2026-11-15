// Traduz os comandos dos botões do dashboard para a API da impressora.
// Entrada: msg.payload = { acao: '...', ...parâmetros }
// Saídas: 1 requisição HTTP · 2 recarregar listas · 3 aviso na tela · 4 console (eco / limpar) · 5 MQTT (Bambu Lab)
const cfg = flow.get('cfg') || {};
const e = flow.get('estado') || {};
const c = msg.payload || {};
const acao = c.acao;
const aviso = texto => [null, null, { topic: 'Impressora 3D', payload: texto }, null];

if (acao === 'atualizarListas') return [null, { topic: 'atualizar' }, null, null];
if (acao === 'limparConsole') return [null, null, null, { topic: 'console:limpar' }];

// Etiqueta de um rolo do AMS (guardada no Node-RED) e, se pedido, tipo/cor enviados à impressora
if (acao === 'amsEtiqueta') {
    const g = Math.round(Number(c.bandeja));
    if (!(g >= 0 && g < 16)) return aviso('Rolo inválido.');
    const etiquetas = flow.get('amsEtiquetas') || {};
    const nome = String(c.nome || '').trim().slice(0, 60), nota = String(c.nota || '').trim().slice(0, 200);
    if (nome || nota) etiquetas[g] = { nome, nota, em: Date.now() };
    else delete etiquetas[g];
    flow.set('amsEtiquetas', etiquetas);
    const saida = [null, null, { topic: 'Impressora 3D', payload: '✔ Rolo ' + (g + 1) + ' salvo' }, { topic: 'etiquetas' }, null];
    if (c.atualizarImpressora && cfg.tipo === 'bambu' && cfg.serial && c.tipo) {
        const PERFIS = { PLA: ['GFL99', 190, 230], PETG: ['GFG99', 220, 260], ABS: ['GFB99', 240, 270], ASA: ['GFB98', 240, 270],
            TPU: ['GFU99', 200, 250], PC: ['GFC99', 260, 280], PA: ['GFN99', 260, 290], PVA: ['GFS99', 190, 210] };
        const perfil = PERFIS[c.tipo] || PERFIS.PLA;
        const cor = String(c.cor || '#FFFFFF').replace('#', '').toUpperCase().slice(0, 6).padEnd(6, 'F') + 'FF';
        saida[4] = { topic: `device/${cfg.serial}/request`, payload: { print: {
            sequence_id: String(Date.now() % 1000000), command: 'ams_filament_setting', ams_id: Math.floor(g / 4), tray_id: g % 4,
            tray_info_idx: perfil[0], tray_type: c.tipo, tray_color: cor, nozzle_temp_min: perfil[1], nozzle_temp_max: perfil[2]
        } } };
        saida[2].payload += ' e enviado para a impressora';
    }
    return saida;
}
if (!cfg.url) return aviso('⚠️ Configure o endereço da impressora primeiro.');
if (acao === 'reconectar') return [null, { topic: 'atualizar' }, { topic: 'Impressora 3D', payload: '🔌 Reconectando…' }, null];
if (['offline', 'conectando'].includes(e.estado)) return aviso('⚠️ A impressora está sem conexão.');

const mk = cfg.tipo !== 'octoprint';
const imprimindo = e.estado === 'imprimindo' || e.estado === 'preparando';
const ocupada = ['imprimindo', 'preparando', 'pausada', 'pausando', 'cancelando'].includes(e.estado);
const n = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));

// Ações que não podem rodar durante a impressão
const bloqueadas = { mover: 1, home: 1, extrudar: 1, desligarMotores: 1 };
if (imprimindo && bloqueadas[acao]) return aviso('⛔ Não é possível fazer isso durante a impressão. Pause primeiro.');
if (acao === 'imprimir' && ocupada) return aviso('⛔ Já existe uma impressão em andamento.');

const xy = cfg.velocidadeXY || 3000, fz = cfg.velocidadeZ || 600, fe = cfg.velocidadeExtrusao || 300;

// ============================================================
//  Bambu Lab: comandos por MQTT em device/<serial>/request
// ============================================================
if (cfg.tipo === 'bambu') {
    const topico = `device/${cfg.serial}/request`;
    const seq = String(Date.now() % 1000000);
    const ok = t => ({ topic: 'Impressora 3D', payload: '✔ ' + t });
    const pub = (descricao, payload, avisar) => [null, null, avisar ? ok(descricao) : null, null, { topic: topico, payload, descricao }];
    const imp = (command, extra) => ({ print: Object.assign({ sequence_id: seq, command }, extra || {}) });
    const g = (descricao, linhas, avisar) => {
        linhas = [].concat(linhas).map(l => String(l).trim()).filter(Boolean);
        if (!linhas.length) return aviso('Nenhum comando para enviar.');
        return [null, null, avisar ? ok(descricao) : null,
            linhas.map(l => ({ topic: 'console:local', tipo: 'cmd', payload: l })),
            { topic: topico, payload: imp('gcode_line', { param: linhas.join('\n') + '\n' }), descricao }];
    };
    switch (acao) {
        case 'pausar': return pub('Pausar', imp('pause'));
        case 'retomar': return pub('Retomar', imp('resume'));
        case 'cancelar': return pub('Cancelar', imp('stop'));
        case 'emergencia':
            return [null, null, ok('Impressão parada e aquecimento desligado'), null, [
                { topic: topico, payload: imp('stop') },
                { topic: topico, payload: imp('gcode_line', { sequence_id: seq + '1', param: 'M104 S0\nM140 S0\n' }) }
            ]];
        case 'reiniciarFirmware':
            return [null, { topic: 'atualizar' }, { topic: 'Impressora 3D', payload: '🔌 Reconectando…' }, null];
        case 'luz':
            return pub(c.ligar ? 'Luz ligada' : 'Luz desligada', {
                system: { sequence_id: seq, command: 'ledctrl', led_node: 'chamber_light', led_mode: c.ligar ? 'on' : 'off',
                    led_on_time: 500, led_off_time: 500, loop_times: 0, interval_time: 0 }
            });
        case 'nivelVelocidade': {
            const nv = Math.round(n(c.nivel, 1, 4));
            return pub('Velocidade: ' + ({ 1: 'Silencioso', 2: 'Padrão', 3: 'Esporte', 4: 'Ludicrous' })[nv], imp('print_speed', { param: String(nv) }), true);
        }
        case 'amsCarregar': {
            const alvo = Math.round(n(c.bandeja, 0, 254));
            const temp = Math.round(n(c.temp || 220, 180, cfg.bicoMax || 300));
            return pub('Carregando filamento do AMS ' + (alvo === 254 ? 'externo' : alvo + 1), imp('ams_change_filament', { target: alvo, curr_temp: temp, tar_temp: temp }), true);
        }
        case 'amsDescarregar':
            return pub('Descarregando filamento', imp('ams_change_filament', { target: 255, curr_temp: 220, tar_temp: 220 }), true);
        case 'home': {
            const eixos = String(c.eixos || '').toUpperCase().replace(/[^XYZ]/g, '');
            return g('Home ' + (eixos || 'todos os eixos'), eixos ? 'G28 ' + eixos.split('').join(' ') : 'G28');
        }
        case 'mover': {
            const eixo = String(c.eixo || '').toUpperCase();
            if (!/^[XYZ]$/.test(eixo)) return aviso('Eixo inválido.');
            const d = n(c.dist, -300, 300);
            return g(`Mover ${eixo} ${d} mm`, ['G91', `G1 ${eixo}${d} F${eixo === 'Z' ? fz : xy}`, 'G90']);
        }
        case 'extrudar': {
            const d = n(c.mm, -100, 100);
            return g((d >= 0 ? 'Extrudar ' : 'Retrair ') + Math.abs(d) + ' mm', ['M83', `G1 E${d} F${fe}`]);
        }
        case 'tempBico': return g('Temperatura do bico', `M104 S${n(c.alvo, 0, cfg.bicoMax || 300)}`);
        case 'tempMesa': return g('Temperatura da mesa', `M140 S${n(c.alvo, 0, cfg.mesaMax || 120)}`);
        case 'preset': return g('Pré-aquecer ' + (c.nome || ''), [`M104 S${n(c.bico, 0, cfg.bicoMax || 300)}`, `M140 S${n(c.mesa, 0, cfg.mesaMax || 120)}`], true);
        case 'desligarAquecimento': return g('Desligar aquecimento', ['M104 S0', 'M140 S0'], true);
        case 'ventoinha': return g('Ventoinha ' + n(c.pct, 0, 100) + '%', `M106 P1 S${Math.round(n(c.pct, 0, 100) * 2.55)}`);
        case 'desligarMotores': return g('Desligar motores', 'M18', true);
        case 'gcode': return g('G-code', String(c.script || '').split(/\r?\n/));
        case 'velocidade': case 'fluxo': case 'babystep':
            return aviso('Esse ajuste não existe na Bambu Lab. Use os níveis de velocidade.');
        case 'imprimir':
            return aviso('Para mandar arquivos para a Bambu Lab use o Bambu Studio ou o Bambu Handy.');
        default:
            return aviso('Comando desconhecido: ' + acao);
    }
}

const headers = { 'Content-Type': 'application/json' };
if (cfg.apiKey) headers['X-Api-Key'] = cfg.apiKey;
const pedido = (descricao, caminho, payload, extra) => Object.assign({
    topic: 'cmd', acao, descricao, url: cfg.url + caminho, method: 'POST', headers: { ...headers },
    payload: payload === undefined ? (mk ? '' : {}) : payload, requestTimeout: 120000, enviadoEm: Date.now()
}, extra || {});

// Envia G-code (cada item é uma linha)
function gcode(descricao, linhas, extra) {
    linhas = [].concat(linhas).map(l => String(l).trim()).filter(Boolean);
    if (!linhas.length) return aviso('Nenhum comando para enviar.');
    const eco = mk ? null : linhas.map(l => ({ topic: 'console:local', tipo: 'cmd', payload: l }));
    const r = mk
        ? pedido(descricao, '/printer/gcode/script?script=' + encodeURIComponent(linhas.join('\n')), '', extra)
        : pedido(descricao, '/api/printer/command', { commands: linhas }, extra);
    r.gcode = linhas;
    return [r, null, null, eco];
}

switch (acao) {
    case 'pausar':
        return [mk ? pedido('Pausar', '/printer/print/pause') : pedido('Pausar', '/api/job', { command: 'pause', action: 'pause' }), null, null, null];
    case 'retomar':
        return [mk ? pedido('Retomar', '/printer/print/resume') : pedido('Retomar', '/api/job', { command: 'pause', action: 'resume' }), null, null, null];
    case 'cancelar':
        return [mk ? pedido('Cancelar', '/printer/print/cancel') : pedido('Cancelar', '/api/job', { command: 'cancel' }), null, null, null];
    case 'emergencia':
        return [mk ? pedido('Parada de emergência', '/printer/emergency_stop', '', { avisarOk: true })
            : pedido('Parada de emergência', '/api/printer/command', { commands: ['M112'] }, { avisarOk: true }), null, null, null];
    case 'reiniciarFirmware':
        return [mk ? pedido('Reiniciar firmware', '/printer/firmware_restart', '', { avisarOk: true })
            : pedido('Reconectar', '/api/connection', { command: 'connect' }, { avisarOk: true }), null, null, null];
    case 'imprimir': {
        const arq = String(c.arquivo || '');
        if (!arq) return aviso('Escolha um arquivo.');
        return [mk ? pedido('Imprimir ' + arq, '/printer/print/start?filename=' + encodeURIComponent(arq), '', { avisarOk: true })
            : pedido('Imprimir ' + arq, '/api/files/local/' + arq.split('/').map(encodeURIComponent).join('/'), { command: 'select', print: true }, { avisarOk: true }), null, null, null];
    }
    case 'home': {
        const eixos = String(c.eixos || '').toUpperCase().replace(/[^XYZ]/g, '');
        return gcode('Home ' + (eixos || 'todos os eixos'), eixos ? 'G28 ' + eixos.split('').join(' ') : 'G28');
    }
    case 'mover': {
        const eixo = String(c.eixo || '').toUpperCase();
        if (!/^[XYZ]$/.test(eixo)) return aviso('Eixo inválido.');
        const d = n(c.dist, -300, 300);
        const mov = ['G91', `G1 ${eixo}${d} F${eixo === 'Z' ? fz : xy}`];
        return gcode(`Mover ${eixo} ${d} mm`, mk ? ['SAVE_GCODE_STATE NAME=_i3d', ...mov, 'RESTORE_GCODE_STATE NAME=_i3d'] : [...mov, 'G90']);
    }
    case 'extrudar': {
        const d = n(c.mm, -100, 100);
        const ext = ['M83', `G1 E${d} F${fe}`];
        return gcode((d >= 0 ? 'Extrudar ' : 'Retrair ') + Math.abs(d) + ' mm', mk ? ['SAVE_GCODE_STATE NAME=_i3d', ...ext, 'RESTORE_GCODE_STATE NAME=_i3d'] : [...ext, 'M82']);
    }
    case 'tempBico':
        return gcode('Temperatura do bico', `M104 S${n(c.alvo, 0, cfg.bicoMax || 300)}`);
    case 'tempMesa':
        return gcode('Temperatura da mesa', `M140 S${n(c.alvo, 0, cfg.mesaMax || 120)}`);
    case 'preset':
        return gcode('Pré-aquecer ' + (c.nome || ''), [`M104 S${n(c.bico, 0, cfg.bicoMax || 300)}`, `M140 S${n(c.mesa, 0, cfg.mesaMax || 120)}`], { avisarOk: true });
    case 'desligarAquecimento':
        return gcode('Desligar aquecimento', ['M104 S0', 'M140 S0'], { avisarOk: true });
    case 'ventoinha': {
        const p = n(c.pct, 0, 100);
        return gcode('Ventoinha ' + p + '%', p > 0 ? `M106 S${Math.round(p * 2.55)}` : 'M107');
    }
    case 'velocidade':
        return gcode('Velocidade ' + n(c.pct, 10, 500) + '%', `M220 S${n(c.pct, 10, 500)}`);
    case 'fluxo':
        return gcode('Fluxo ' + n(c.pct, 50, 200) + '%', `M221 S${n(c.pct, 50, 200)}`);
    case 'babystep': {
        const d = n(c.mm, -1, 1);
        return gcode(`Ajuste Z ${d > 0 ? '+' : ''}${d} mm`, mk ? `SET_GCODE_OFFSET Z_ADJUST=${d} MOVE=1` : `M290 Z${d}`);
    }
    case 'desligarMotores':
        return gcode('Desligar motores', 'M84', { avisarOk: true });
    case 'gcode': {
        const linhas = String(c.script || '').split(/\r?\n/);
        if (!mk && linhas.some(l => /^\s*M112\b/i.test(l))) return gcode('G-code', linhas, { avisarOk: true });
        return gcode('G-code', linhas);
    }
    default:
        return aviso('Comando desconhecido: ' + acao);
}
