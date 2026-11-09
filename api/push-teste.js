// Envia uma notificação de teste pelo mesmo caminho dos lembretes de prazo
// (servidor -> Apple/Google -> aparelho), para os aparelhos da conta logada.
import webpush from "web-push";
import { rota, exigirUsuario, supabaseAdmin, ErroHttp } from "./_lib.js";
import { configLembretes } from "./_auto.js";

export default rota(async (req) => {
  const usuario = await exigirUsuario(req);
  const cfg = await configLembretes();
  if (!cfg.publicKey || !cfg.privateKey) {
    throw new ErroHttp(500, "Chaves de notificação indisponíveis no servidor. Rode o supabase/schema.sql e abra o app de novo.");
  }
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

  const inscricoes = await supabaseAdmin(
    `push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${encodeURIComponent(usuario.id)}`,
  );
  if (!inscricoes.length) {
    throw new ErroHttp(409, "Nenhum aparelho com lembretes ativos nesta conta. Desative e ative os lembretes de novo.");
  }

  const payload = JSON.stringify({
    title: "Recados",
    body: "Assim aparecerão os lembretes de prazo. 👍",
    tag: "teste",
    url: "/",
  });
  let enviados = 0;
  const erros = [];
  for (const s of inscricoes) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 300, urgency: "high" });
      enviados++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supabaseAdmin(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" });
        erros.push("inscrição expirada (desative e ative os lembretes de novo)");
      } else {
        console.error("push teste", e.statusCode, e.body || e.message);
        erros.push(`erro ${e.statusCode || "de rede"}: ${String(e.body || e.message || "").slice(0, 120)}`);
      }
    }
  }
  return { enviados, erros };
});
