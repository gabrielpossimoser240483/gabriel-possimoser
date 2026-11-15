// ============================================================
//  CONFIGURAÇÃO DA IMPRESSORA 3D
//  Edite os valores de PADRAO abaixo, ou use o grupo
//  "Configuração" no próprio dashboard (o que for salvo lá
//  tem prioridade sobre estes valores).
// ============================================================
const PADRAO = {
    nome: 'Minha impressora',
    tipo: 'moonraker',            // 'moonraker' (Klipper / Mainsail / Fluidd) ou 'octoprint'
    url: '',                      // ex.: http://192.168.0.50:7125 (Moonraker) ou http://192.168.0.50 (OctoPrint)
    apiKey: '',                   // OctoPrint: obrigatória. Moonraker: só se a autenticação estiver ativa
    webcamModo: 'snapshot',       // 'snapshot' (fotos passando pelo Node-RED, funciona fora de casa)
                                  // 'stream'   (vídeo direto da impressora, mais fluido, só na rede local)
    webcamIntervalo: 2,           // segundos entre fotos no modo snapshot
    webcamSnapshot: '',           // vazio = descobre sozinho
    webcamStream: '',             // vazio = descobre sozinho
    bicoMax: 300,
    mesaMax: 120,
    velocidadeXY: 3000,           // mm/min nos botões de movimento
    velocidadeZ: 600,
    velocidadeExtrusao: 300,
    presets: [
        { nome: 'PLA', bico: 205, mesa: 60 },
        { nome: 'PETG', bico: 240, mesa: 80 },
        { nome: 'ABS', bico: 250, mesa: 100 },
        { nome: 'TPU', bico: 225, mesa: 50 }
    ]
};

// Só estes campos podem ser alterados pelo dashboard
const EDITAVEIS = ['nome', 'tipo', 'url', 'apiKey', 'webcamModo', 'webcamIntervalo',
    'webcamSnapshot', 'webcamStream', 'bicoMax', 'mesaMax', 'presets'];
const MASCARA = '••••••••';

let salvo = flow.get('cfgSalva') || {};

if (msg.topic === 'salvar' && msg.payload && typeof msg.payload === 'object') {
    const novo = { ...salvo };
    for (const k of EDITAVEIS) {
        if (msg.payload[k] === undefined) continue;
        if (k === 'apiKey' && msg.payload[k] === MASCARA) continue; // chave não alterada
        novo[k] = msg.payload[k];
    }
    if (typeof novo.url === 'string') novo.url = novo.url.trim().replace(/\/+$/, '');
    if (novo.url && !/^https?:\/\//i.test(novo.url)) novo.url = 'http://' + novo.url;
    ['webcamIntervalo', 'bicoMax', 'mesaMax'].forEach(k => {
        if (novo[k] !== undefined) novo[k] = Number(novo[k]) || PADRAO[k];
    });
    salvo = novo;
    flow.set('cfgSalva', salvo);
} else if (msg.topic === 'restaurar') {
    salvo = {};
    flow.set('cfgSalva', salvo);
}

const cfg = { ...PADRAO, ...salvo };
cfg.url = (cfg.url || '').replace(/\/+$/, '');
flow.set('cfg', cfg);

node.status(cfg.url
    ? { fill: 'green', shape: 'dot', text: cfg.tipo + ' · ' + cfg.url }
    : { fill: 'yellow', shape: 'ring', text: 'defina o endereço da impressora' });

const paraTela = {
    topic: 'cfg',
    payload: { ...cfg, apiKey: cfg.apiKey ? MASCARA : '' },
    salvoEm: msg.topic === 'salvar' ? Date.now() : undefined
};

// 1: tela de configuração · 2: recarregar listas · 3: zerar cache do interpretador
return [paraTela, { topic: 'atualizar' }, { topic: 'reset' }];
