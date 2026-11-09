// Configuração automática dos lembretes: gera e guarda no banco (tabela app_config,
// acessível só pelo servidor) as chaves VAPID e o segredo do agendador, e registra o
// endereço do app. Assim o usuário não precisa criar essas variáveis na Vercel.
// Se as variáveis VAPID_* / CRON_SECRET existirem na Vercel, elas têm prioridade.
import webpush from "web-push";
import { supabaseAdmin } from "./_lib.js";

async function lerConfig() {
  const linhas = await supabaseAdmin("app_config?select=chave,valor");
  return Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
}

async function gravarSeNaoExistir(valores) {
  const linhas = Object.entries(valores).map(([chave, valor]) => ({ chave, valor }));
  await supabaseAdmin("app_config?on_conflict=chave", {
    method: "POST",
    body: linhas,
    prefer: "resolution=ignore-duplicates,return=minimal",
  });
}

export function enderecoDoApp() {
  const env = process.env;
  const dominio = env.APP_URL || env.VERCEL_PROJECT_PRODUCTION_URL || "";
  if (!dominio) return "";
  return (dominio.startsWith("http") ? dominio : `https://${dominio}`).replace(/\/+$/, "");
}

/** Devolve { publicKey, privateKey, subject, cronSecret }, criando o que faltar. */
export async function configLembretes() {
  const env = process.env;
  let cfg = {};
  try {
    cfg = await lerConfig();
    const faltando = {};
    if (!env.VAPID_PUBLIC_KEY && !cfg.vapid_public) {
      const k = webpush.generateVAPIDKeys();
      faltando.vapid_public = k.publicKey;
      faltando.vapid_private = k.privateKey;
    }
    const app = enderecoDoApp();
    if (app && cfg.app_url !== app) {
      await supabaseAdmin("app_config?on_conflict=chave", {
        method: "POST",
        body: [{ chave: "app_url", valor: app }],
        prefer: "resolution=merge-duplicates,return=minimal",
      });
    }
    if (Object.keys(faltando).length) {
      await gravarSeNaoExistir(faltando);
      cfg = await lerConfig(); // relê: se duas chamadas gerarem ao mesmo tempo, vale a primeira
    }
  } catch (e) {
    // Tabela ainda não criada (falta rodar o SQL) ou chave secreta ausente: segue sem lembretes.
    console.warn("app_config indisponível:", e.message);
  }
  const app = enderecoDoApp();
  return {
    publicKey: env.VAPID_PUBLIC_KEY || cfg.vapid_public || "",
    privateKey: env.VAPID_PRIVATE_KEY || cfg.vapid_private || "",
    subject: env.VAPID_SUBJECT || (app ? app : "mailto:recados@example.com"),
    cronSecret: env.CRON_SECRET || cfg.cron_secret || "",
  };
}
