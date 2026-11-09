// Recebe o texto (colado do WhatsApp ou transcrito do áudio) e usa o Claude Haiku para extrair os dados.
import { rota, exigirUsuario, claudeJSON, ErroHttp, texto } from "./_lib.js";

const SCHEMA = {
  type: "object",
  properties: {
    recados: {
      type: "array",
      items: {
        type: "object",
        properties: {
          remetente: { type: "string", description: "Nome de quem mandou o recado. Vazio se não for possível saber." },
          assunto: { type: "string", description: "Assunto curto, até 8 palavras." },
          resumo: { type: "string", description: "Resumo claro em 1 a 3 frases, dizendo o que precisa ser feito." },
          prazo: { type: "string", description: "Prazo no formato AAAA-MM-DDTHH:MM (horário local) ou string vazia se não houver prazo." },
          prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
        },
        required: ["remetente", "assunto", "resumo", "prazo", "prioridade"],
        additionalProperties: false,
      },
    },
  },
  required: ["recados"],
  additionalProperties: false,
};

const SYSTEM = `Você organiza recados de trabalho de um profissional brasileiro.
Você recebe um texto colado do WhatsApp ou transcrito de um áudio e extrai os recados.

Regras:
- Normalmente há UM recado. Só separe em vários se o texto claramente trouxer pedidos independentes (ex.: várias mensagens de pessoas diferentes ou assuntos sem relação).
- remetente: o nome de quem mandou. Em conversas do WhatsApp o nome costuma aparecer como "[data hora] Nome: mensagem" ou "Nome: mensagem". Em áudio, a pessoa pode dizer "o João pediu...". Se o nome for parecido com um da lista de pessoas conhecidas, use exatamente o nome da lista. Se não der para saber, deixe vazio.
- assunto: curto e específico (até 8 palavras), sem ponto final.
- resumo: 1 a 3 frases objetivas em português do Brasil, com o que precisa ser feito, valores, nomes e detalhes importantes.
- prazo: converta expressões como "amanhã", "sexta", "até as 15h", "semana que vem" para data e hora absolutas, usando a data/hora atual informada. Se só houver dia, use 18:00. "De manhã/cedo" = 09:00, "à tarde" = 14:00, "fim do dia" = 18:00. Se não houver prazo, use "".
- prioridade: "alta" se for urgente, tiver prazo hoje/amanhã, envolver cliente insatisfeito, dinheiro ou chefe cobrando; "baixa" se for apenas informativo ou sem ação necessária; caso contrário "media".
- Nunca invente informações que não estão no texto.`;

export default rota(async (req) => {
  await exigirUsuario(req);
  const corpo = req.body || {};
  const conteudo = texto(corpo.texto, 20000).trim();
  if (!conteudo) throw new ErroHttp(400, "Envie algum texto para organizar.");

  const pessoas = Array.isArray(corpo.pessoas) ? corpo.pessoas.slice(0, 80).map((p) => texto(p, 60)) : [];
  const agora = texto(corpo.agora, 80) || new Date().toISOString();
  const fuso = texto(corpo.fuso, 60) || "America/Sao_Paulo";

  const usuario = `Data e hora atual: ${agora} (fuso ${fuso}).
Pessoas conhecidas: ${pessoas.length ? pessoas.join(", ") : "(nenhuma ainda)"}

<texto>
${conteudo}
</texto>`;

  const dados = await claudeJSON({ system: SYSTEM, usuario, schema: SCHEMA });
  const recados = (dados.recados || []).slice(0, 20).map((r) => ({
    remetente: texto(r.remetente, 80).trim(),
    assunto: texto(r.assunto, 140).trim(),
    resumo: texto(r.resumo, 2000).trim(),
    prazo: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(r.prazo || "") ? r.prazo.slice(0, 16) : "",
    prioridade: ["alta", "media", "baixa"].includes(r.prioridade) ? r.prioridade : "media",
  }));
  return { recados };
});
