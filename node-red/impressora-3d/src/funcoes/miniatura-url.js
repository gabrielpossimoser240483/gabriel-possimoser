// Prepara a busca da miniatura do arquivo que está sendo impresso.
const url = flow.get('miniaturaUrl');
const cfg = flow.get('cfg') || {};
if (!url) {
    msg.statusCode = 404;
    msg.textoVazio = 'Sem miniatura';
    return [null, msg];
}
msg.url = url;
msg.textoVazio = 'Sem miniatura';
msg.method = 'GET';
msg.headers = cfg.apiKey ? { 'X-Api-Key': cfg.apiKey } : {};
msg.requestTimeout = 5000;
msg.payload = '';
return [msg, null];
