// LED do portão (zigbee2mqtt/varanda_led_porta_social): acende e apaga nos horários escolhidos no cartão.
// Padrão: acende 18:30, apaga 23:00 (em 15/11/2026 o Gabriel escolheu 18:00 às 06:00). Pode passar da meia-noite (ex.: 19:00 até 02:00).
// Ajustes salvos em /data/led_portao_automacao.json  ->  { ligada, inicio: minutos, fim: minutos }
// saída 1 -> LED (mqtt)   saída 2 -> cartão
const ARQ = '/data/led_portao_automacao.json';
let cfg = context.get('cfg');
if (!cfg) {
    cfg = { ligada: true, inicio: 18 * 60 + 30, fim: 23 * 60 };
    try { Object.assign(cfg, JSON.parse(fs.readFileSync(ARQ, 'utf8'))); } catch (e) { }
    context.set('cfg', cfg);
}
const salvar = () => { context.set('cfg', cfg); try { fs.writeFileSync(ARQ, JSON.stringify(cfg)); } catch (e) { node.warn('não salvou: ' + e.message); } };
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const agora = new Date();
const min = agora.getHours() * 60 + agora.getMinutes();
const dentro = m => cfg.inicio <= cfg.fim ? (m >= cfg.inicio && m < cfg.fim) : (m >= cfg.inicio || m < cfg.fim);

function cartao() {
    let prox;
    if (!cfg.ligada) prox = 'Automático desligado: o LED só acende na mão';
    else if (dentro(min)) prox = 'Apaga sozinho às ' + hm(cfg.fim);
    else prox = 'Acende sozinho às ' + hm(cfg.inicio);
    return { payload: { auto: cfg.ligada, led: context.get('led') === 'ON', prox, inicio: cfg.inicio, fim: cfg.fim } };
}
const status = () => node.status({ fill: cfg.ligada ? 'green' : 'grey', shape: cfg.ligada ? 'dot' : 'ring',
    text: (cfg.ligada ? 'automático ' : 'DESLIGADO ') + hm(cfg.inicio) + '–' + hm(cfg.fim) });

if (msg.topic === 'zigbee2mqtt/varanda_led_porta_social') {      // estado real do LED
    const v = msg.payload && msg.payload.state;
    if (v !== 'ON' && v !== 'OFF') return null;
    if (context.get('led') === v) return null;
    context.set('led', v);
    return [null, cartao()];
}
if (msg.topic === 'chave') {
    cfg.ligada = !!msg.payload; salvar(); status();
    if (cfg.ligada && dentro(min) && context.get('led') !== 'ON') return [{ payload: { state: 'ON' } }, cartao()];   // ligou o automático no horário: acende
    return [null, cartao()];
}
if (msg.topic === 'horario') {
    const i = Math.round(Number(msg.payload.inicio)), f = Math.round(Number(msg.payload.fim));
    if (i >= 0 && i < 1440 && f >= 0 && f < 1440 && i !== f) { cfg.inicio = i; cfg.fim = f; salvar(); }
    status();
    // mudou o horário: já deixa o LED como deveria estar agora
    if (cfg.ligada) { const v = dentro(min) ? 'ON' : 'OFF'; if (context.get('led') !== v) return [{ payload: { state: v } }, cartao()]; }
    return [null, cartao()];
}
if (msg.topic === 'led') return [{ payload: { state: msg.payload ? 'ON' : 'OFF' } }, null];   // toque manual
if (msg.topic === 'iniciar') { status(); return [null, cartao()]; }

if (msg.topic === 'minuto') {                                   // roda a cada minuto
    if (context.get('ultMin') === min) return null;
    context.set('ultMin', min);
    status();
    const atualiza = min % 5 === 0 ? cartao() : null;
    if (!cfg.ligada) return [null, atualiza];
    if (min === cfg.inicio) return [{ payload: { state: 'ON' } }, cartao()];
    if (min === cfg.fim) return [{ payload: { state: 'OFF' } }, cartao()];
    return [null, atualiza];
}
return null;
