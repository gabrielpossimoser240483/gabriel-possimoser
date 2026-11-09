// Ajuda para iniciantes: gera um par de chaves VAPID (notificações) e um CRON_SECRET aleatório.
// Não guarda nada: só mostra valores novos para você copiar para a Vercel.
import webpush from "web-push";
import { randomBytes } from "node:crypto";

export default function handler(req, res) {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  const cron = randomBytes(24).toString("hex");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chaves geradas</title>
<style>body{font:16px system-ui;margin:24px;max-width:720px}code{display:block;word-break:break-all;background:#f1f3f5;padding:12px;border-radius:8px;margin:4px 0 16px;user-select:all}@media(prefers-color-scheme:dark){body{background:#111;color:#eee}code{background:#222}}</style>
<h1>Chaves novas</h1>
<p>Copie cada valor para <b>Vercel → Settings → Environment Variables</b>. Cada vez que esta página abre, gera chaves diferentes — use um conjunto só.</p>
<b>VAPID_PUBLIC_KEY</b><code>${publicKey}</code>
<b>VAPID_PRIVATE_KEY</b><code>${privateKey}</code>
<b>CRON_SECRET</b><code>${cron}</code>
</html>`);
}
