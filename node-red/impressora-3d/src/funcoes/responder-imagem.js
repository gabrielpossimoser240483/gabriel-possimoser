// Devolve a imagem ao navegador, ou um aviso em SVG se não conseguiu buscar.
const ok = typeof msg.statusCode === 'number' && msg.statusCode < 400 && Buffer.isBuffer(msg.payload) && msg.payload.length > 0;
const tipo = ok ? ((msg.headers && msg.headers['content-type']) || 'image/jpeg') : 'image/svg+xml';
if (!ok) {
    const texto = msg.textoVazio || 'Imagem indisponível';
    msg.payload = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#1f2328"/><text x="320" y="185" fill="#8b949e" font-family="sans-serif" font-size="22" text-anchor="middle">${texto}</text></svg>`;
    msg.statusCode = 200; // o aviso em si é uma imagem válida
}
msg.headers = { 'Content-Type': tipo, 'Cache-Control': 'no-store, max-age=0' };
return msg;
