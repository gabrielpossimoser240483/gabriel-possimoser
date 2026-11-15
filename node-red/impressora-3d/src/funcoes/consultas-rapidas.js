// Consultas feitas a cada poucos segundos: estado, temperaturas, posição, console.
// Saída 1: requisições HTTP · Saída 2: aviso de "sem configuração" para o interpretador
const cfg = flow.get('cfg');
if (!cfg || !cfg.url) return [null, { topic: 'semConfig' }];
// Bambu Lab: os dados chegam sozinhos por MQTT; o tique só serve para checar se a conexão caiu
if (cfg.tipo === 'bambu') return [null, { topic: 'bambu:tick' }];

const headers = {};
if (cfg.apiKey) headers['X-Api-Key'] = cfg.apiKey;
const req = (topic, caminho) => ({
    topic, url: cfg.url + caminho, method: 'GET', headers: { ...headers },
    requestTimeout: 4000, enviadoEm: Date.now(), payload: ''
});

if (cfg.tipo === 'octoprint') {
    return [[req('octo:printer', '/api/printer'), req('octo:job', '/api/job')], null];
}

// Moonraker / Klipper
const objetos = ['webhooks', 'print_stats', 'virtual_sdcard', 'display_status', 'extruder',
    'heater_bed', 'toolhead', 'gcode_move', 'motion_report', 'fan', 'idle_timeout']
    .concat(flow.get('mkSensores') || []);
const qs = objetos.map(o => encodeURIComponent(o)).join('&');

const pedidos = [req('mk:status', '/printer/objects/query?' + qs)];
// console: busca as últimas linhas a cada 2 ciclos
const ciclo = (context.get('ciclo') || 0) + 1;
context.set('ciclo', ciclo);
if (ciclo % 2 === 0) pedidos.push(req('mk:console', '/server/gcode_store?count=80'));
return [pedidos, null];
