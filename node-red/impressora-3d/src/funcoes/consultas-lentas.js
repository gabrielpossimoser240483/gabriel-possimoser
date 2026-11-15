// Consultas feitas com menos frequência: arquivos, histórico, sistema, câmeras.
const cfg = flow.get('cfg');
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
