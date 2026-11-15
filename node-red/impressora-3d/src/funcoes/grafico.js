// Separa as temperaturas em séries para o gráfico (uma mensagem por linha).
const e = msg.payload || {};
if (!e.bico || e.online === false) return null;
const agora = Date.now();
if (agora - (context.get('ultimo') || 0) < 1500) return null; // no máximo 1 ponto a cada 1,5 s
context.set('ultimo', agora);
const s = [];
const add = (topic, v) => { if (typeof v === 'number') s.push({ topic, payload: v }); };
add('Bico', e.bico.atual);
add('Bico (alvo)', e.bico.alvo);
add('Mesa', e.mesa.atual);
add('Mesa (alvo)', e.mesa.alvo);
for (const x of e.sensores || []) add(x.nome, x.atual);
return [s];
