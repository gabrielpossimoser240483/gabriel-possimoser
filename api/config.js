// Entrega ao app apenas configurações PÚBLICAS (nunca chaves secretas).
import { rota } from "./_lib.js";
import { configLembretes } from "./_auto.js";
import { supabaseAdmin, emailsPermitidos } from "./_lib.js";

async function temDono() {
  try {
    return (await supabaseAdmin("app_config?select=chave&chave=eq.dono_id")).length > 0;
  } catch {
    return false;
  }
}

export default rota(
  async () => {
    const env = process.env;
    const faltando = [];
    const alternativos = { SUPABASE_PUBLIC_KEY: "SUPABASE_ANON_KEY", SUPABASE_SECRET_KEY: "SUPABASE_SERVICE_ROLE_KEY" };
    for (const nome of ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_PUBLIC_KEY", "SUPABASE_SECRET_KEY"]) {
      if (!env[nome] && !(alternativos[nome] && env[alternativos[nome]])) faltando.push(nome);
    }
    const [lembretes, cadastroFechado] = faltando.length
      ? [{ publicKey: "" }, false]
      : await Promise.all([configLembretes(), emailsPermitidos().length ? false : temDono()]);
    return {
      supabaseUrl: (env.SUPABASE_URL || "").replace(/\/+$/, ""),
      supabaseKey: env.SUPABASE_PUBLIC_KEY || env.SUPABASE_ANON_KEY || "",
      vapidPublicKey: lembretes.publicKey,
      transcricaoServidor: Boolean(env.GROQ_API_KEY),
      cadastroFechado,
      faltando,
    };
  },
  { metodos: ["GET"] },
);
