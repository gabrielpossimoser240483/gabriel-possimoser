// Câmera das Bambu Lab A1 / P1: conexão TLS na porta 6000 com um protocolo próprio.
// Envia um pacote de login (usuário bblp + código de acesso) e recebe fotos JPEG
// (cabeçalho de 16 bytes + imagem). A conexão fica aberta enquanto alguém está
// olhando e fecha sozinha após 30 s sem pedidos.
// (o módulo "tls" do Node.js está declarado na aba Setup deste nó)
const cfg = flow.get('cfg') || {};
const chave = cfg.url + '|' + cfg.apiKey;
let cam = context.get('cam');

function fechar(c) {
    if (c && c.sock) { try { c.sock.destroy(); } catch (e) { } c.sock = null; }
}

function conectar() {
    if (cam && cam.sock && cam.chave === chave) return cam;
    fechar(cam);
    const c = { chave, buf: Buffer.alloc(0), frame: cam && cam.chave === chave ? cam.frame : null, frameT: 0, espera: [], erro: '', pedido: Date.now() };
    c.sock = tls.connect({ host: cfg.url, port: 6000, rejectUnauthorized: false });
    c.sock.setTimeout(20000, () => { c.erro = 'tempo esgotado'; fechar(c); });
    c.sock.on('secureConnect', () => {
        const auth = Buffer.alloc(80);
        auth.writeUInt32LE(0x40, 0);
        auth.writeUInt32LE(0x3000, 4);
        auth.write('bblp', 16, 'ascii');
        auth.write(String(cfg.apiKey || ''), 48, 'ascii');
        c.sock.write(auth);
    });
    c.sock.on('data', d => {
        c.buf = Buffer.concat([c.buf, d]);
        while (c.buf.length >= 16) {
            const tam = c.buf.readUInt32LE(0);
            if (tam <= 0 || tam > 8 * 1024 * 1024) { c.buf = Buffer.alloc(0); break; }
            if (c.buf.length < 16 + tam) break;
            const img = c.buf.subarray(16, 16 + tam);
            c.buf = c.buf.subarray(16 + tam);
            if (img[0] === 0xFF && img[1] === 0xD8) {
                c.frame = Buffer.from(img);
                c.frameT = Date.now();
                const w = c.espera; c.espera = []; w.forEach(f => f());
            }
        }
        if (Date.now() - c.pedido > 30000) fechar(c);
    });
    c.sock.on('error', e => { c.erro = e.message; });
    c.sock.on('close', () => { c.sock = null; const w = c.espera; c.espera = []; w.forEach(f => f()); });
    cam = c;
    context.set('cam', c);
    return c;
}

function responder(c) {
    msg.headers = {};
    if (c.frame && Date.now() - c.frameT < 15000) {
        msg.statusCode = 200;
        msg.headers['content-type'] = 'image/jpeg';
        msg.payload = c.frame;
    } else {
        msg.statusCode = 503;
        msg.payload = '';
        msg.textoVazio = c.erro ? 'Câmera indisponível (' + c.erro + ')' : 'Câmera indisponível';
    }
    node.send(msg);
}

if (!cfg.url || !cfg.apiKey) {
    msg.statusCode = 404; msg.payload = ''; msg.textoVazio = 'Configure IP e código de acesso';
    return msg;
}
const c = conectar();
c.pedido = Date.now();
if (c.frame && Date.now() - c.frameT < 3000) {
    responder(c);
} else {
    let feito = false;
    const fim = () => { if (!feito) { feito = true; responder(c); } };
    c.espera.push(fim);
    setTimeout(fim, 8000);
}
return null;
