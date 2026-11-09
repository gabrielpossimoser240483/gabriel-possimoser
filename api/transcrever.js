// OPCIONAL: transcrição de áudio no servidor com Whisper (Groq, plano gratuito).
// Se GROQ_API_KEY não estiver configurada, o app usa o reconhecimento de voz do próprio iPhone.
import { rota, exigirUsuario, ErroHttp } from "./_lib.js";

export default rota(async (req) => {
  await exigirUsuario(req);
  if (!process.env.GROQ_API_KEY) throw new ErroHttp(501, "Transcrição no servidor não configurada.");

  const { audio, tipo } = req.body || {};
  if (typeof audio !== "string" || !audio) throw new ErroHttp(400, "Áudio não recebido.");
  const bytes = Buffer.from(audio, "base64");
  if (bytes.length > 4_000_000) throw new ErroHttp(413, "Áudio longo demais. Grave até uns 3 minutos.");

  const mime = typeof tipo === "string" && tipo.startsWith("audio/") ? tipo.split(";")[0] : "audio/mp4";
  const extensao = { "audio/mp4": "m4a", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" }[mime] || "m4a";

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), `recado.${extensao}`);
  form.append("model", process.env.GROQ_MODEL || "whisper-large-v3-turbo");
  form.append("language", "pt");
  form.append("response_format", "json");

  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });
  if (!r.ok) {
    console.error("Groq", r.status, await r.text());
    throw new ErroHttp(502, "Falha ao transcrever o áudio. Tente de novo.");
  }
  const dados = await r.json();
  return { texto: String(dados.text || "").trim() };
});
