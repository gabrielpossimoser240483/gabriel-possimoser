// Lâmpada Jimmy (na Tuya se chama "Dimmer") — controla pela nuvem da Tuya.
// Projeto Tuya "Home Assistant", Western America.
const ACCESS_ID = env.get('TUYA_ACCESS_ID') || 'COLOQUE_O_ACCESS_ID';
const ACCESS_SECRET = env.get('TUYA_ACCESS_SECRET') || 'COLOQUE_O_ACCESS_SECRET';
const DEVICE_ID = 'eb947f00c7f9b3fcafb9qv';
const HOST = 'openapi.tuyaus.com';

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

const pct2bri = p => Math.round(10 + (Math.min(100, Math.max(1, p)) - 1) * 990 / 99);
const bri2pct = v => Math.round(1 + (v - 10) * 99 / 990);

try {
    let cmds = null;
    if (msg.topic === 'onoff') cmds = [{ code: 'switch_led', value: !!msg.payload }];
    else if (msg.topic === 'brilho') cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'white' }, { code: 'bright_value_v2', value: pct2bri(Number(msg.payload)) }];
    else if (msg.topic === 'cena') cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'white' }, { code: 'bright_value_v2', value: pct2bri(Number(msg.payload.brilho)) }, { code: 'temp_value_v2', value: Math.round(Number(msg.payload.temperatura) * 10) }];
    else if (msg.topic === 'temperatura') cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'white' }, { code: 'temp_value_v2', value: Math.round(Number(msg.payload) * 10) }];

    if (cmds) {
        await chamar('POST', `/v1.0/iot-03/devices/${DEVICE_ID}/commands`, { commands: cmds });
        node.status({ fill: 'green', shape: 'dot', text: 'enviado ' + new Date().toLocaleTimeString('pt-BR') });
        await new Promise(r => setTimeout(r, 1500));
    }

    // Lê o estado e atualiza os controles do dashboard
    const st = await chamar('GET', `/v1.0/iot-03/devices/${DEVICE_ID}/status`);
    const v = Object.fromEntries(st.map(s => [s.code, s.value]));
    if (!cmds) node.status({ fill: v.switch_led ? 'yellow' : 'grey', shape: 'ring', text: (v.switch_led ? 'ligada' : 'desligada') + ' ' + bri2pct(v.bright_value_v2) + '%' });
    return [
        { payload: !!v.switch_led },
        { payload: bri2pct(v.bright_value_v2) },
        { payload: Math.round(v.temp_value_v2 / 10) }
    ];
} catch (e) {
    node.status({ fill: 'red', shape: 'dot', text: String(e.message).slice(0, 40) });
    node.error(e.message, msg);
    return null;
}
