// Entrega ao app apenas configurações PÚBLICAS (nunca chaves secretas).
import { rota } from "./_lib.js";
import { configLembretes } from "./_auto.js";

export default rota(
  async () => {
    const env = process.env;
    const faltando = [];
    const alternativos = { SUPABASE_PUBLIC_KEY: "SUPABASE_ANON_KEY", SUPABASE_SECRET_KEY: "SUPABASE_SERVICE_ROLE_KEY" };
    for (const nome of ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_PUBLIC_KEY", "SUPABASE_SECRET_KEY"]) {
      if (!env[nome] && !(alternativos[nome] && env[alternativos[nome]])) faltando.push(nome);
    }
    const lembretes = faltando.length ? { publicKey: "" } : await configLembretes();
    return {
      supabaseUrl: (env.SUPABASE_URL || "").replace(/\/+$/, ""),
      supabaseKey: env.SUPABASE_PUBLIC_KEY || env.SUPABASE_ANON_KEY || "",
      vapidPublicKey: lembretes.publicKey,
      transcricaoServidor: Boolean(env.GROQ_API_KEY),
      faltando,
    };
  },
  { metodos: ["GET"] },
);
