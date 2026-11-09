// Gera o "Resumo do dia" com o Claude Haiku a partir dos recados que o app envia.
import { rota, exigirUsuario, claudeTexto, texto } from "./_lib.js";

const SYSTEM = `Você é um assistente que escreve o resumo do dia de trabalho de um profissional brasileiro, a partir dos recados dele.
Escreva em português do Brasil, direto e curto, para ler no celular em menos de 1 minuto.

Formato (use exatamente estes títulos, com "## "):
## Visão geral
Uma ou duas frases sobre o dia.
## Prioridades agora
Lista com "- " das 3 a 5 coisas mais importantes a fazer, mais urgentes primeiro, citando quem pediu e o prazo.
## Prazos próximos
Lista com "- " dos prazos dos próximos dias (dia da semana e hora). Se não houver, escreva "- Nenhum prazo próximo."
## Recados de hoje
Lista com "- " curtíssima dos recados que chegaram hoje. Se não houver, escreva "- Nenhum recado novo hoje."

Use **negrito** só para nomes de pessoas e prazos vencidos. Não invente nada que não esteja nos dados.`;

function linha(r) {
  return {
    de: texto(r.remetente, 60),
    assunto: texto(r.assunto, 120),
    resumo: texto(r.resumo, 400),
    prazo: texto(r.prazo, 40) || undefined,
    prioridade: texto(r.prioridade, 10),
    status: texto(r.status, 12),
    recebido: texto(r.recebido, 40),
  };
}

export default rota(async (req) => {
  await exigirUsuario(req);
  const corpo = req.body || {};
  const lista = (nome) => (Array.isArray(corpo[nome]) ? corpo[nome].slice(0, 80).map(linha) : []);
  const dados = { hoje: lista("hoje"), pendentes: lista("pendentes"), prazos: lista("prazos") };

  const usuario = `Agora: ${texto(corpo.agora, 80)}

Dados (JSON):
${JSON.stringify(dados)}`;

  const resumo = await claudeTexto({ system: SYSTEM, usuario, maxTokens: 6000 });
  return { resumo };
});
