// Automação da Jimmy com o sensor de presença do banheiro (zigbee2mqtt/banheiro_presenca).
// Alguém entrou e está escuro (lux abaixo de 80):
//   das 22h às 6h  -> modo NOITE (padrão: quente, 20%)
//   resto do dia   -> modo DIA   (padrão: frio, 100%)
// Ninguém mais no banheiro -> apaga (só se foi a automação que acendeu).
// Os valores são ajustados no dashboard (grupo "Automação Jimmy") e ficam salvos em /data/jimmy_automacao.json
const LUX_MINIMO = 80;
const NOITE_INICIO = 22, NOITE_FIM = 6;
const ARQ = path.join('/data', 'jimmy_automacao.json');
const PADRAO = { ligada: true, noite_brilho: 20, noite_temp: 0, dia_brilho: 100, dia_temp: 100 };

let cfg = context.get('cfg');
if (!cfg) {
    cfg = { ...PADRAO };
    try { Object.assign(cfg, JSON.parse(fs.readFileSync(ARQ, 'utf8'))); } catch (e) { }
    context.set('cfg', cfg);
}
const painel = () => [
    { topic: 'ligada', payload: cfg.ligada }, { payload: cfg.noite_brilho }, { payload: cfg.noite_temp },
    { payload: cfg.dia_brilho }, { payload: cfg.dia_temp }
];

// Ajustes vindos do dashboard
if (msg.topic === 'mostrar') return [null, ...painel()];
if (msg.topic && msg.topic.startsWith('cfg_')) {
    const k = msg.topic.slice(4);
    if (k in PADRAO) {
        cfg[k] = k === 'ligada' ? !!msg.payload : Number(msg.payload);
        context.set('cfg', cfg);
        try { fs.writeFileSync(ARQ, JSON.stringify(cfg)); } catch (e) { node.warn('não salvou ajustes: ' + e.message); }
        node.status({ fill: 'green', shape: 'ring', text: 'ajuste salvo: ' + k + ' = ' + cfg[k] });
    }
    return null;
}

// Sensor de presença
const p = msg.payload || {};
const presenca = p.presence;
const lux = p.illuminance_lux !== undefined ? p.illuminance_lux : p.illuminance;
if (presenca === undefined) return null;

const anterior = context.get('presenca');
context.set('presenca', presenca);
if (presenca === anterior) return null;          // só age quando muda

if (!presenca) {
    if (!context.get('acendeu')) return null;
    context.set('acendeu', false);
    node.status({ fill: 'grey', shape: 'ring', text: 'apagou ' + new Date().toLocaleTimeString('pt-BR') });
    return [{ topic: 'onoff', payload: false }, null, null, null, null, null];
}

if (!cfg.ligada) { node.status({ fill: 'grey', shape: 'dot', text: 'automação desligada' }); return null; }
if (lux !== undefined && lux >= LUX_MINIMO) {
    node.status({ fill: 'blue', shape: 'ring', text: 'claro (' + lux + ' lux), não acendeu' });
    return null;
}

const h = new Date().getHours();
const noite = h >= NOITE_INICIO || h < NOITE_FIM;
const brilho = noite ? cfg.noite_brilho : cfg.dia_brilho;
const temp = noite ? cfg.noite_temp : cfg.dia_temp;
context.set('acendeu', true);
node.status({ fill: 'yellow', shape: 'dot', text: (noite ? 'noite ' : 'dia ') + brilho + '% ' + new Date().toLocaleTimeString('pt-BR') });
return [{ topic: 'cena', payload: { brilho, temperatura: temp } }, null, null, null, null, null];
