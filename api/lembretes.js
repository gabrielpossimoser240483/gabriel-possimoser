// Chamado a cada 5 minutos pelo agendador do Supabase (pg_cron). Envia notificações push
// dos recados pendentes cujo prazo está chegando.
import webpush from "web-push";
import { rota, supabaseAdmin, ErroHttp } from "./_lib.js";
import { configLembretes } from "./_auto.js";

export default rota(
  async (req) => {
    const cfg = await configLembretes();
    const enviado = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!cfg.cronSecret || enviado !== cfg.cronSecret) throw new ErroHttp(401, "Não autorizado.");
    if (!cfg.publicKey || !cfg.privateKey) throw new ErroHttp(500, "Chaves de notificação indisponíveis.");
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

    const antecedencia = Number(process.env.LEMBRETE_ANTECEDENCIA_MIN) || 60;
    const ate = new Date(Date.now() + antecedencia * 60_000).toISOString();
    const desde = new Date(Date.now() - 24 * 3600_000).toISOString(); // não avisa prazos vencidos há mais de 1 dia

    const recados = await supabaseAdmin(
      `recados?select=id,user_id,remetente,assunto,prazo` +
        `&status=eq.pendente&lembrete_enviado=eq.false` +
        `&prazo=lte.${encodeURIComponent(ate)}&prazo=gte.${encodeURIComponent(desde)}` +
        `&order=prazo.asc&limit=200`,
    );
    if (!recados.length) return { avisos: 0 };

    const usuarios = [...new Set(recados.map((r) => r.user_id))];
    const inscricoes = await supabaseAdmin(
      `push_subscriptions?select=endpoint,user_id,p256dh,auth&user_id=in.(${usuarios.join(",")})`,
    );

    let avisos = 0;
    for (const r of recados) {
      const prazo = new Date(r.prazo);
      const vencido = prazo.getTime() <= Date.now();
      const hora = prazo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: process.env.FUSO || "America/Sao_Paulo" });
      const payload = JSON.stringify({
        title: vencido ? `⏰ Prazo vencido: ${r.assunto || "recado"}` : `⏰ Prazo às ${hora}: ${r.assunto || "recado"}`,
        body: r.remetente ? `Pedido de ${r.remetente}` : "Toque para ver o recado",
        tag: `recado-${r.id}`,
        url: `/?recado=${r.id}`,
      });
      for (const s of inscricoes.filter((i) => i.user_id === r.user_id)) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: "high" });
          avisos++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            await supabaseAdmin(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" });
          } else {
            console.error("push", e.statusCode, e.body || e.message);
          }
        }
      }
    }

    await supabaseAdmin(`recados?id=in.(${recados.map((r) => r.id).join(",")})`, {
      method: "PATCH",
      body: { lembrete_enviado: true },
      prefer: "return=minimal",
    });
    return { recados: recados.length, avisos };
  },
  { metodos: ["POST", "GET"] },
);
