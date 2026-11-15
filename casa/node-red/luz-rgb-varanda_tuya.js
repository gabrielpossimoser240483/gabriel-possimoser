// Lâmpada Jimmy (na Tuya se chama "Dimmer") — controla pela nuvem da Tuya.
// Projeto Tuya "Home Assistant", Western America.
const ACCESS_ID = env.get('TUYA_ACCESS_ID') || 'COLOQUE_O_ACCESS_ID';
const ACCESS_SECRET = env.get('TUYA_ACCESS_SECRET') || 'COLOQUE_O_ACCESS_SECRET';
const DEVICE_ID = 'eb59af9ff60d7c7abcfgfj';
const HOST = 'openapi.tuyaus.com';


// conexão sempre aberta com a Tuya (evita refazer a conexão segura a cada comando)
function AGENTE() { let a = context.get('agente'); if (!a) { a = new https.Agent({ keepAlive: true, maxSockets: 4 }); context.set('agente', a); } return a; }
function req(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const t = Date.now().toString();
        const b = body ? JSON.stringify(body) : '';
        const sts = [method, crypto.createHash('sha256').update(b).digest('hex'), '', path].join('\n');
        const sign = crypto.createHmac('sha256', ACCESS_SECRET).update(ACCESS_ID + (token || '') + t + sts).digest('hex').toUpperCase();
        const headers = { client_id: ACCESS_ID, sign, t, sign_method: 'HMAC-SHA256', 'Content-Type': 'application/json' };
        if (token) headers.access_token = token;
        const r = https.request({ host: HOST, path, method, headers, timeout: 15000, agent: AGENTE() }, res => {
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


const pct2v = p => Math.round(10 + (Math.min(100, Math.max(1, p)) - 1) * 990 / 99);
const v2pct = v => Math.round(1 + (v - 10) * 99 / 990);
function hex2hs(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: Math.round((h * 60 + 360) % 360), s: Math.round(mx ? d / mx * 1000 : 0) };
}
function hs2hex(h, s) {
    s = s / 1000; const f = n => { const k = (n + h / 60) % 6; return 1 - s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

try {
    const st0 = context.get('ultimo') || {};
    let cmds = null;
    const p = msg.payload;
    if (msg.topic === 'onoff') cmds = [{ code: 'switch_led', value: !!p }];
    else if (msg.topic === 'modo') cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: p === 'cor' ? 'colour' : 'white' }];
    else if (msg.topic === 'brilho') {
        if (st0.modo === 'cor') { const hs = hex2hs(st0.cor || '#ffffff'); cmds = [{ code: 'switch_led', value: true }, { code: 'colour_data_v2', value: { h: hs.h, s: hs.s, v: pct2v(Number(p)) } }]; }
        else cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'white' }, { code: 'bright_value_v2', value: pct2v(Number(p)) }];
    }
    else if (msg.topic === 'temperatura') cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'white' }, { code: 'temp_value_v2', value: Math.round(Number(p) * 10) }];
    else if (msg.topic === 'cor') { const hs = hex2hs(p); cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'colour' }, { code: 'colour_data_v2', value: { h: hs.h, s: hs.s, v: pct2v(st0.brilho || 100) } }]; }
    else if (msg.topic === 'cena') {   // usado pelas automações: {ligar, modo, brilho, temperatura, cor}
        if (p.ligar === false) cmds = [{ code: 'switch_led', value: false }];
        else if (p.modo === 'cor') { const hs = hex2hs(p.cor); cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'colour' }, { code: 'colour_data_v2', value: { h: hs.h, s: hs.s, v: pct2v(p.brilho) } }]; }
        else cmds = [{ code: 'switch_led', value: true }, { code: 'work_mode', value: 'white' }, { code: 'bright_value_v2', value: pct2v(p.brilho) }, { code: 'temp_value_v2', value: Math.round(p.temperatura * 10) }];
    }

    if (cmds && st0.modo) {
        const prev = { ...st0 };
        if (msg.topic === 'onoff') prev.ligada = !!p;
        else if (msg.topic === 'modo') { prev.ligada = true; prev.modo = p === 'cor' ? 'cor' : 'branco'; }
        else if (msg.topic === 'brilho') { prev.ligada = true; prev.brilho = Number(p); }
        else if (msg.topic === 'temperatura') { prev.ligada = true; prev.modo = 'branco'; prev.temperatura = Number(p); }
        else if (msg.topic === 'cor') { prev.ligada = true; prev.modo = 'cor'; prev.cor = String(p).toLowerCase(); }
        else if (msg.topic === 'cena') { prev.ligada = p.ligar !== false; if (p.ligar !== false) { prev.modo = p.modo === 'cor' ? 'cor' : 'branco'; prev.brilho = p.brilho; if (p.cor) prev.cor = p.cor; } }
        node.send({ payload: prev });
    }
    if (cmds) {
        await chamar('POST', `/v1.0/iot-03/devices/${DEVICE_ID}/commands`, { commands: cmds });
        node.status({ fill: 'green', shape: 'dot', text: 'enviado ' + new Date().toLocaleTimeString('pt-BR') });
        await new Promise(r => setTimeout(r, 2500));
    }

    const st = await chamar('GET', `/v1.0/iot-03/devices/${DEVICE_ID}/status`);
    const v = Object.fromEntries(st.map(s => [s.code, s.value]));
    let c = {}; try { c = typeof v.colour_data_v2 === 'string' ? JSON.parse(v.colour_data_v2) : (v.colour_data_v2 || {}); } catch (e) { }
    const modo = v.work_mode === 'colour' ? 'cor' : 'branco';
    const est = {
        ligada: !!v.switch_led, modo,
        brilho: modo === 'cor' ? v2pct(c.v || 1000) : v2pct(v.bright_value_v2 || 1000),
        temperatura: Math.round((v.temp_value_v2 || 0) / 10),
        cor: hs2hex(c.h || 0, c.s === undefined ? 1000 : c.s)
    };
    context.set('ultimo', est);
    if (!cmds) node.status({ fill: est.ligada ? 'yellow' : 'grey', shape: 'ring', text: (est.ligada ? 'ligada ' : 'desligada ') + est.modo + ' ' + est.brilho + '%' });
    if (msg.topic === 'ler' && JSON.stringify(est) === context.get('ultEnviado')) return null;
    context.set('ultEnviado', JSON.stringify(est));
    return { payload: est };
} catch (e) {
    node.status({ fill: 'red', shape: 'dot', text: String(e.message).slice(0, 40) });
    if (!/timeout/.test(e.message)) node.error(e.message, msg);
    return null;
}
