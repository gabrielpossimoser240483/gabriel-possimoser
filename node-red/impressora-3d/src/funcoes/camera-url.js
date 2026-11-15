// Prepara a busca da foto da câmera (o navegador pede ao Node-RED, que pede à impressora).
// Saídas: 1 buscar por HTTP · 2 responder direto (sem câmera) · 3 câmera da Bambu Lab
const cfg = flow.get('cfg') || {};
if (cfg.tipo === 'bambu') return [null, null, msg];
const url = flow.get('webcamSnapshotUrl');
if (!url) {
    msg.statusCode = 404;
    msg.textoVazio = 'Câmera não configurada';
    return [null, msg, null];
}
msg.url = url;
msg.textoVazio = 'Câmera indisponível';
msg.method = 'GET';
msg.headers = {};
msg.requestTimeout = 5000;
msg.payload = '';
return [msg, null, null];
