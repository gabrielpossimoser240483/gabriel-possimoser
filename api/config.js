// Entrega ao app apenas configurações PÚBLICAS (nunca chaves secretas).
import { rota } from "./_lib.js";

export default rota(
  async () => {
    const env = process.env;
    const faltando = [];
    for (const nome of ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_PUBLIC_KEY", "SUPABASE_SECRET_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET"]) {
      const alternativo = { SUPABASE_PUBLIC_KEY: "SUPABASE_ANON_KEY", SUPABASE_SECRET_KEY: "SUPABASE_SERVICE_ROLE_KEY" }[nome];
      if (!env[nome] && !(alternativo && env[alternativo])) faltando.push(nome);
    }
    return {
      supabaseUrl: (env.SUPABASE_URL || "").replace(/\/+$/, ""),
      supabaseKey: env.SUPABASE_PUBLIC_KEY || env.SUPABASE_ANON_KEY || "",
      vapidPublicKey: env.VAPID_PUBLIC_KEY || "",
      transcricaoServidor: Boolean(env.GROQ_API_KEY),
      faltando,
    };
  },
  { metodos: ["GET"] },
);
