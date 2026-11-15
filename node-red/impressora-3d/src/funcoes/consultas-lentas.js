// Consultas feitas com menos frequência: arquivos, histórico, sistema, câmeras.
// Saídas: 1 requisições HTTP · 2 controle da conexão MQTT (Bambu) · 3 publicações MQTT (Bambu)
const cfg = flow.get('cfg');
const mudouConfig = msg.topic === 'atualizar';

// ---------- Bambu Lab (MQTT local, porta 8883) ----------
if (cfg && cfg.tipo === 'bambu') {
    if (!cfg.url || !cfg.serial || !cfg.apiKey) return [null, mudouConfig ? { action: 'disconnect' } : null, null];
    const req = `device/${cfg.serial}/request`;
    const pushall = { topic: req, payload: { pushing: { sequence_id: '0', command: 'pushall', version: 1, push_target: 1 } } };
    if (mudouConfig) {
        context.set('ciclo', 0);
        return [null, [
            { action: 'unsubscribe', topic: true },
            {
                action: 'connect', broker: {
                    broker: cfg.url, port: 8883, usetls: true, verifyservercert: false,
                    username: 'bblp', password: cfg.apiKey, clientid: 'nodered_' + Math.random().toString(16).slice(2, 10),
                    keepalive: 30, cleansession: true, force: true
                }
            },
            { action: 'subscribe', topic: `device/${cfg.serial}/report`, qos: 0 }
        ], [pushall, { topic: req, payload: { info: { sequence_id: '0', command: 'get_version' } } }]];
    }
    // relatório completo a cada 5 min (a A1 só manda o que muda)
    const ciclo = (context.get('ciclo') || 0) + 1;
    context.set('ciclo', ciclo);
    return [null, null, ciclo % 10 === 0 ? pushall : null];
}
if (mudouConfig) node.send([null, { action: 'disconnect' }, null]);
if (!cfg || !cfg.url) return null;

const headers = {};
if (cfg.apiKey) headers['X-Api-Key'] = cfg.apiKey;
const req = (topic, caminho) => ({
    topic, url: cfg.url + caminho, method: 'GET', headers: { ...headers },
    requestTimeout: 8000, enviadoEm: Date.now(), payload: ''
});

if (cfg.tipo === 'octoprint') {
    return [[
        req('octo:arquivos', '/api/files?recursive=true'),
        req('octo:versao', '/api/version'),
        req('octo:conexao', '/api/connection'),
        req('octo:settings', '/api/settings')
    ]];
}

return [[
    req('mk:arquivos', '/server/files/list?root=gcodes'),
    req('mk:historico', '/server/history/list?limit=30&order=desc'),
    req('mk:totais', '/server/history/totals'),
    req('mk:proc', '/machine/proc_stats'),
    req('mk:printerinfo', '/printer/info'),
    req('mk:serverinfo', '/server/info'),
    req('mk:objetos', '/printer/objects/list'),
    req('mk:webcams', '/server/webcams/list')
]];
