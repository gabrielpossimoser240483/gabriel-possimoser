// Fechadura EKAZA (Zigbee, pela nuvem da Tuya — projeto Home Assistant).
// Lê a fechadura a cada 5 s, detecta cada evento pela hora em que a Tuya o recebeu e:
//   saída 1 -> aviso no celular (Pushover)   saída 2 -> cartão do dashboard (Sala)
//   saída 3 -> chave "Trava interna"   saída 4 -> lista "Som da campainha"   saída 5 -> chave "Avisos no celular"
// Entradas do dashboard: topic 'avisos' (true/false), 'reverse_lock' (true/false), 'doorbell_song' (ding_0..9)
const ACCESS_ID = env.get('TUYA_ACCESS_ID') || 'COLOQUE_O_ACCESS_ID';
const ACCESS_SECRET = env.get('TUYA_ACCESS_SECRET') || 'COLOQUE_O_ACCESS_SECRET';
const DEVICE_ID = 'ebc777d960783fb572mjea';
const HOST = 'openapi.tuyaus.com';
const PUSH = { token: 'TOKEN_PUSHOVER', user: 'USER_PUSHOVER' };

function req(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const t = Date.now().toString();
        const b = body ? JSON.stringify(body) : '';
        const sts = [method, crypto.createHash('sha256').update(b).digest('hex'), '', path].join('\n');
        const sign = crypto.createHmac('sha256', ACCESS_SECRET).update(ACCESS_ID + (token || '') + t + sts).digest('hex').toUpperCase();
        const headers = { client_id: ACCESS_ID, sign, t, sign_method: 'HMAC-SHA256', 'Content-Type': 'application/json' };
        if (token) headers.access_token = token;
        const r = https.request({ host: HOST, path, method, headers, timeout: 15000 }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
        });
        r.on('error', reject); r.on('timeout', () => r.destroy(new Error('timeout')));
        if (b) r.write(b); r.end();
    });
}
async function token() {
    const c = context.get('tk');
    if (c && c.exp > Date.now()) return c.v;
    const r = await req('GET', '/v1.0/token?grant_type=1');
    if (!r.success) throw new Error('Tuya token: ' + r.msg);
    context.set('tk', { v: r.result.access_token, exp: Date.now() + (r.result.expire_time - 120) * 1000 });
    return r.result.access_token;
}
async function chamar(method, path, body) {
    let r = await req(method, path, body, await token());
    if (!r.success && /token/i.test(r.msg || '')) { context.set('tk', null); r = await req(method, path, body, await token()); }
    if (!r.success) throw new Error('Tuya: ' + r.msg);
    return r.result;
}

const METODO = { unlock_fingerprint: 'digital', unlock_password: 'senha', unlock_card: 'cartão', unlock_temporary: 'senha temporária',
    unlock_dynamic: 'senha dinâmica', unlock_remote: 'abertura remota', unlock_voice_remote: 'comando de voz' };
const ALARME = { wrong_finger: 'digital errada', wrong_password: 'senha errada', wrong_card: 'cartão não reconhecido', wrong_face: 'rosto não reconhecido',
    tongue_bad: 'trinco com defeito', too_hot: 'temperatura alta', tongue_not_out: 'trinco não fechou', pry: 'TENTATIVA DE ARROMBAMENTO', key_in: 'chave na fechadura',
    power_off: 'sem bateria', shock: 'impacto na porta', unclosed_time: 'porta aberta há muito tempo', low_battery: 'bateria fraca', defense: 'alarme de proteção' };
const hora = ms => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function cartao(p) {
    const v = c => (p[c] || {}).value;
    return { payload: {
        porta: v('closed_opened') === 'closed' ? 'Fechada' : v('closed_opened') === 'open' ? 'Aberta' : 'Desconhecido',
        bateria: v('residual_electricity'),
        travaInterna: !!v('reverse_lock'),
        avisos: global.get('avisa_fechadura2') !== false,
        historico: (global.get('hist_fechadura') || []).slice(0, 12),
        erro: (context.get('erro') && Date.now() - context.get('erro').t < 60000) ? context.get('erro').txt : ''
    } };
}

try {
    // Comandos vindos do dashboard
    if (msg.topic === 'abrir') {
        const ult = context.get('ultAbrir') || 0;
        if (Date.now() - ult < 5000) return null;          // evita abrir duas vezes seguidas
        context.set('ultAbrir', Date.now());
        const tk = await chamar('POST', `/v1.0/devices/${DEVICE_ID}/door-lock/password-ticket`);
        await chamar('POST', `/v1.0/smart-lock/devices/${DEVICE_ID}/password-free/door-operate`, { ticket_id: tk.ticket_id, open: true });
        const hist = global.get('hist_fechadura') || [];
        hist.unshift({ quando: hora(Date.now()), txt: '🔓 Aberta pelo dashboard' });
        global.set('hist_fechadura', hist.slice(0, 50));
        context.set('erro', null);
        node.status({ fill: 'yellow', shape: 'dot', text: 'abriu pelo dashboard ' + new Date().toLocaleTimeString('pt-BR') });
        await new Promise(r => setTimeout(r, 2500));
    }
    else if (msg.topic === 'avisos') { global.set('avisa_fechadura2', !!msg.payload); }
    else if (msg.topic === 'reverse_lock' || msg.topic === 'doorbell_song') {
        await chamar('POST', `/v1.0/iot-03/devices/${DEVICE_ID}/commands`, { commands: [{ code: msg.topic, value: msg.payload }] });
        await new Promise(r => setTimeout(r, 1500));
    }

    const res = await chamar('GET', `/v2.0/cloud/thing/${DEVICE_ID}/shadow/properties`);
    const p = Object.fromEntries(res.properties.map(x => [x.code, { value: x.value, time: x.time }]));
    const ant = context.get('ant');
    context.set('ant', Object.fromEntries(Object.entries(p).map(([k, x]) => [k, x.time])));

    const eventos = [];
    if (ant) {
        const novo = c => p[c] && p[c].time && p[c].time !== ant[c];
        for (const c in METODO) if (novo(c) && p[c].value) eventos.push({ t: p[c].time, txt: `🔓 Aberta por ${METODO[c]} (usuário ${p[c].value})`, push: 'abriu' });
        if (novo('closed_opened')) eventos.push({ t: p.closed_opened.time, txt: p.closed_opened.value === 'closed' ? '🚪 Porta fechada' : '🚪 Porta aberta', push: null });
        if (novo('doorbell') && p.doorbell.value) eventos.push({ t: p.doorbell.time, txt: '🔔 Tocaram a campainha', push: 'campainha' });
        if (novo('alarm_lock')) eventos.push({ t: p.alarm_lock.time, txt: '⚠️ Alarme: ' + (ALARME[p.alarm_lock.value] || p.alarm_lock.value), push: 'alarme' });
        if (novo('hijack') && p.hijack.value) eventos.push({ t: p.hijack.time, txt: '🚨 ABERTA SOB COAÇÃO (digital de pânico)', push: 'alarme' });
        if (novo('residual_electricity') && p.residual_electricity.value > 0 && p.residual_electricity.value <= 20)
            eventos.push({ t: p.residual_electricity.time, txt: '🔋 Bateria da fechadura em ' + p.residual_electricity.value + '%', push: 'alarme' });
    }
    eventos.sort((a, b) => a.t - b.t);
    const agora = Date.now(); for (const e of eventos) e.t = agora; // mostra a hora em que o Node-RED viu o evento (a hora da fechadura às vezes vem errada)

    let pushes = [];
    if (eventos.length) {
        const hist = global.get('hist_fechadura') || [];
        for (const e of eventos) hist.unshift({ quando: hora(e.t), txt: e.txt });
        global.set('hist_fechadura', hist.slice(0, 50));
        if (global.get('avisa_fechadura2') !== false)
            pushes = eventos.filter(e => e.push).map(e => ({ headers: { 'Content-Type': 'application/json' },
                payload: { ...PUSH, title: 'Fechadura', message: e.txt + ' às ' + hora(e.t).slice(-5), priority: e.push === 'alarme' ? 1 : 0 } }));
        node.status({ fill: 'yellow', shape: 'dot', text: eventos[eventos.length - 1].txt.slice(0, 40) });
    } else if (!context.get('ok')) node.status({ fill: 'green', shape: 'ring', text: 'lendo a fechadura' });
    context.set('ok', true);

    const c = cartao(p);
    if (msg.topic === 'ler' && !eventos.length && JSON.stringify(c.payload) === context.get('ultCartao')) return null; // nada mudou
    context.set('ultCartao', JSON.stringify(c.payload));
    return [pushes.length ? pushes : null, c, { payload: !!p.reverse_lock.value }, { payload: p.doorbell_song.value }, { payload: global.get('avisa_fechadura2') !== false }];
} catch (e) {
    node.status({ fill: 'red', shape: 'dot', text: String(e.message).slice(0, 40) });
    if (msg.topic === 'abrir') { context.set('erro', { t: Date.now(), txt: 'Não abriu: ' + e.message }); context.set('ultCartao', null); return [null, { payload: { erro: 'Não abriu: ' + e.message } }, null, null, null]; }
    if (!/timeout/.test(e.message)) node.error(e.message, msg);
    return null;
}
