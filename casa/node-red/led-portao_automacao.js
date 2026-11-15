// LED do portão (zigbee2mqtt/varanda_led_porta_social): liga às 18h30 e desliga às 23h.
// O cartão "LED do portão" (Varanda) liga/desliga essa automação e acende/apaga o LED na mão.
// Escolha salva em /data/led_portao_automacao.json
// saída 1 -> LED (mqtt)   saída 2 -> cartão
const ARQ = '/data/led_portao_automacao.json';
let ligada = context.get('ligada');
if (ligada === undefined) {
    ligada = true;
    try { ligada = JSON.parse(fs.readFileSync(ARQ, 'utf8')).ligada !== false; } catch (e) { }
    context.set('ligada', ligada);
}
const agora = new Date();
const min = agora.getHours() * 60 + agora.getMinutes();
const LIGA = 18 * 60 + 30, DESLIGA = 23 * 60;

function cartao() {
    const dentro = min >= LIGA && min < DESLIGA;
    let prox;
    if (!ligada) prox = 'Automático desligado: o LED só acende na mão';
    else if (dentro) prox = 'Apaga sozinho às 23:00';
    else prox = min < LIGA ? 'Acende sozinho hoje às 18:30' : 'Acende sozinho amanhã às 18:30';
    return { payload: { auto: ligada, led: context.get('led') === 'ON', prox } };
}
const status = () => node.status({ fill: ligada ? 'green' : 'grey', shape: ligada ? 'dot' : 'ring', text: ligada ? 'automático ligado' : 'automático DESLIGADO' });

if (msg.topic === 'zigbee2mqtt/varanda_led_porta_social') {      // estado real do LED
    const v = msg.payload && msg.payload.state;
    if (v !== 'ON' && v !== 'OFF') return null;
    if (context.get('led') === v) return null;
    context.set('led', v);
    return [null, cartao()];
}
if (msg.topic === 'chave') {
    ligada = !!msg.payload;
    context.set('ligada', ligada);
    try { fs.writeFileSync(ARQ, JSON.stringify({ ligada })); } catch (e) { node.warn('não salvou: ' + e.message); }
    status();
    return [null, cartao()];
}
if (msg.topic === 'led') return [{ payload: { state: msg.payload ? 'ON' : 'OFF' } }, null];   // botão manual
if (msg.topic === 'iniciar' || msg.topic === 'atualiza') { status(); return [null, cartao()]; }
status();
if (!ligada) return [null, null];
if (msg.topic === 'ligar') return [{ payload: { state: 'ON' } }, null];
if (msg.topic === 'desligar') return [{ payload: { state: 'OFF' } }, null];
return null;
