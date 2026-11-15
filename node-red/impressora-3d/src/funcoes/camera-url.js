// Prepara a busca da foto da câmera (o navegador pede ao Node-RED, que pede à impressora).
const url = flow.get('webcamSnapshotUrl');
if (!url) {
    msg.statusCode = 404;
    msg.textoVazio = 'Câmera não configurada';
    return [null, msg];
}
msg.url = url;
msg.textoVazio = 'Câmera indisponível';
msg.method = 'GET';
msg.headers = {};
msg.requestTimeout = 5000;
msg.payload = '';
return [msg, null];
