// Funções compartilhadas pelas rotas /api. Arquivos que começam com "_" não viram rotas na Vercel.
import Anthropic from "@anthropic-ai/sdk";

export const MODELO = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLIC_KEY = process.env.SUPABASE_PUBLIC_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let cliente;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ErroHttp(500, "A variável ANTHROPIC_API_KEY não foi configurada no servidor.");
  }
  // O SDK lê ANTHROPIC_API_KEY do ambiente do servidor. A chave nunca vai para o navegador.
  cliente ??= new Anthropic({ maxRetries: 2, timeout: 25_000 });
  return cliente;
}

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/** Envolve um handler: só aceita POST, trata erros e devolve JSON. */
export function rota(fn, { metodos = ["POST"] } = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!metodos.includes(req.method)) {
      res.setHeader("Allow", metodos.join(", "));
      return res.status(405).json({ erro: "Método não permitido." });
    }
    try {
      const resultado = await fn(req, res);
      if (!res.headersSent) res.status(200).json(resultado ?? { ok: true });
    } catch (e) {
      const status = e instanceof ErroHttp ? e.status : statusAnthropic(e);
      if (status >= 500) console.error(e);
      if (!res.headersSent) res.status(status).json({ erro: mensagemErro(e, status) });
    }
  };
}

function statusAnthropic(e) {
  if (e instanceof Anthropic.RateLimitError) return 429;
  if (e instanceof Anthropic.AuthenticationError) return 502;
  if (e instanceof Anthropic.APIConnectionError) return 503;
  return 500;
}

function mensagemErro(e, status) {
  if (e instanceof ErroHttp) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "A chave da Anthropic é inválida. Confira ANTHROPIC_API_KEY na Vercel.";
  if (e instanceof Anthropic.RateLimitError) return "Muitas requisições à IA agora. Tente de novo em instantes.";
  if (e instanceof Anthropic.APIConnectionError) return "Não foi possível falar com a IA. Tente de novo.";
  if (e instanceof Anthropic.APIError && /credit|billing/i.test(e.message)) return "Sem créditos na conta da Anthropic.";
  return status === 500 ? "Erro interno no servidor." : String(e.message || e);
}

/** Confere o token de login do Supabase enviado pelo app. Sem login válido, nada de IA. */
export async function exigirUsuario(req) {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    throw new ErroHttp(500, "SUPABASE_URL e SUPABASE_PUBLIC_KEY não foram configuradas no servidor.");
  }
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new ErroHttp(401, "Faça login novamente.");
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new ErroHttp(401, "Sua sessão expirou. Faça login novamente.");
  const usuario = await r.json();
  const permitidos = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (permitidos.length) {
    if (!permitidos.includes(String(usuario.email || "").toLowerCase())) {
      throw new ErroHttp(403, "Este e-mail não tem permissão para usar a IA deste app.");
    }
    return usuario;
  }
  // Sem ALLOWED_EMAILS: a IA fica reservada ao dono do app (a primeira conta que usar o app).
  const dono = await garantirDono(usuario.id);
  if (dono && dono !== usuario.id) {
    throw new ErroHttp(403, "A IA deste app é de uso exclusivo do dono da conta.");
  }
  return usuario;
}

/** Registra o primeiro usuário como dono (uma vez só) e devolve o id do dono. */
export async function garantirDono(idUsuario) {
  try {
    const atual = await supabaseAdmin("app_config?select=valor&chave=eq.dono_id");
    if (atual.length) return atual[0].valor;
    await supabaseAdmin("app_config?on_conflict=chave", {
      method: "POST",
      body: [{ chave: "dono_id", valor: idUsuario }],
      prefer: "resolution=ignore-duplicates,return=minimal",
    });
    const depois = await supabaseAdmin("app_config?select=valor&chave=eq.dono_id");
    return depois[0]?.valor || null;
  } catch (e) {
    // Tabela app_config ainda não criada: não bloqueia (comportamento antigo).
    console.warn("dono indisponível:", e.message);
    return null;
  }
}

/** Acesso administrativo ao banco (só no servidor, usado pelos lembretes). */
export async function supabaseAdmin(caminho, { method = "GET", body, prefer } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new ErroHttp(500, "SUPABASE_URL e SUPABASE_SECRET_KEY não foram configuradas no servidor.");
  }
  const headers = { apikey: SUPABASE_SECRET_KEY, "Content-Type": "application/json" };
  // Chaves antigas (service_role) são JWT e também vão no Authorization; as novas (sb_secret_) não.
  if (SUPABASE_SECRET_KEY.startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase ${method} ${caminho}: ${r.status} ${await r.text()}`);
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

/** Chama o Claude e devolve o texto da resposta (ignora blocos de raciocínio). */
async function chamarClaude(params) {
  const msg = await anthropic().messages.create({ model: MODELO, ...params });
  if (msg.stop_reason === "refusal") {
    throw new ErroHttp(422, "A IA não conseguiu processar este conteúdo.");
  }
  if (msg.stop_reason === "max_tokens") {
    throw new ErroHttp(422, "O texto é longo demais para processar de uma vez. Tente dividir.");
  }
  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Resposta em JSON garantida pelo formato estruturado (structured outputs). */
export async function claudeJSON({ system, usuario, schema, maxTokens = 8000 }) {
  const texto = await chamarClaude({
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: usuario }],
    output_config: { effort: "low", format: { type: "json_schema", schema } },
  });
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroHttp(502, "A IA devolveu uma resposta inesperada. Tente de novo.");
  }
}

export async function claudeTexto({ system, usuario, maxTokens = 8000 }) {
  return chamarClaude({
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: usuario }],
    output_config: { effort: "low" },
  });
}

export function texto(valor, max) {
  return String(valor ?? "").slice(0, max);
}
