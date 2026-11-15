// Traduz os comandos dos botões do dashboard para a API da impressora.
// Entrada: msg.payload = { acao: '...', ...parâmetros }
// Saídas: 1 requisição HTTP · 2 recarregar listas · 3 aviso na tela · 4 console (eco / limpar)
const cfg = flow.get('cfg') || {};
const e = flow.get('estado') || {};
const c = msg.payload || {};
const acao = c.acao;
const aviso = texto => [null, null, { topic: 'Impressora 3D', payload: texto }, null];

if (acao === 'atualizarListas') return [null, { topic: 'atualizar' }, null, null];
if (acao === 'limparConsole') return [null, null, null, { topic: 'console:limpar' }];
if (!cfg.url) return aviso('⚠️ Configure o endereço da impressora primeiro.');
if (['offline', 'conectando'].includes(e.estado)) return aviso('⚠️ A impressora está sem conexão.');

const mk = cfg.tipo !== 'octoprint';
const imprimindo = e.estado === 'imprimindo';
const ocupada = ['imprimindo', 'pausada', 'pausando', 'cancelando'].includes(e.estado);
const n = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));

// Ações que não podem rodar durante a impressão
const bloqueadas = { mover: 1, home: 1, extrudar: 1, desligarMotores: 1 };
if (imprimindo && bloqueadas[acao]) return aviso('⛔ Não é possível fazer isso durante a impressão. Pause primeiro.');
if (acao === 'imprimir' && ocupada) return aviso('⛔ Já existe uma impressão em andamento.');

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

const xy = cfg.velocidadeXY || 3000, fz = cfg.velocidadeZ || 600, fe = cfg.velocidadeExtrusao || 300;

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
