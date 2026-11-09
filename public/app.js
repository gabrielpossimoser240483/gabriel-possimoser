// Recados de Trabalho — app (sem etapa de build: é só publicar a pasta /public).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.99.3/+esm";

// ---------- utilidades ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const PRIORIDADES = { alta: "Alta", media: "Média", baixa: "Baixa" };
const ORDEM_PRIO = { alta: 0, media: 1, baixa: 2 };

function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "dataset") Object.assign(n.dataset, v);
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) n.append(f.nodeType ? f : String(f));
  return n;
}

function icone(id) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  const u = document.createElementNS(ns, "use");
  u.setAttribute("href", `#${id}`);
  s.append(u);
  return s;
}

function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const pad = (n) => String(n).padStart(2, "0");
/** Date -> "AAAA-MM-DDTHH:MM" no horário local (para <input type="datetime-local">). */
function paraInputLocal(data) {
  if (!data) return "";
  const d = new Date(data);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** "AAAA-MM-DDTHH:MM" (local) -> ISO em UTC para o banco. */
function deInputLocal(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d) ? null : d.toISOString();
}
function chaveDia(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function mesmoDia(a, b) {
  return chaveDia(a) === chaveDia(b);
}
function rotuloDia(data) {
  const d = new Date(data);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  const opcoes = { weekday: "long", day: "numeric", month: "long" };
  if (d.getFullYear() !== hoje.getFullYear()) opcoes.year = "numeric";
  return d.toLocaleDateString("pt-BR", opcoes);
}
function hora(data) {
  return new Date(data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function textoPrazo(data) {
  const d = new Date(data);
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  let dia;
  if (mesmoDia(d, hoje)) dia = "hoje";
  else if (mesmoDia(d, amanha)) dia = "amanhã";
  else if (Math.abs(d - hoje) < 6 * 864e5) dia = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  else dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${dia} ${hora(d)}`;
}
function agoraLocal() {
  const d = new Date();
  return `${d.toLocaleDateString("pt-BR", { weekday: "long" })}, ${paraInputLocal(d).replace("T", " ")}`;
}

let timerAviso;
function avisar(msg, { acao, ao } = {}) {
  const a = $("#aviso");
  a.replaceChildren(msg);
  if (acao) a.append(el("button", { type: "button", onclick: () => { a.classList.remove("visivel"); ao(); } }, acao));
  a.classList.add("visivel");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => a.classList.remove("visivel"), acao ? 5000 : 3000);
}

function lerLocal(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
}
function gravarLocal(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {}
}

// ---------- tema ----------
function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === "claro") raiz.dataset.theme = "light";
  else if (tema === "escuro") raiz.dataset.theme = "dark";
  else delete raiz.dataset.theme;
  $$("#tema button").forEach((b) => b.classList.toggle("ativo", b.dataset.valor === tema));
}
aplicarTema(lerLocal("tema", "auto"));

// ---------- estado ----------
const estado = {
  config: null,
  sb: null,
  usuario: null,
  recados: lerLocal("recados-cache", []),
  filtros: { status: "pendente", prioridade: "", pessoa: "", busca: "" },
  editando: null,
  criarConta: false,
};

// ---------- API do servidor ----------
async function api(caminho, corpo) {
  const { data } = await estado.sb.auth.getSession();
  const token = data.session?.access_token;
  const r = await fetch(`/api/${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  });
  let json = {};
  try {
    json = await r.json();
  } catch {}
  if (!r.ok) throw new Error(json.erro || `Erro ${r.status}`);
  return json;
}

// ---------- dados (Supabase) ----------
async function carregarRecados() {
  const { data, error } = await estado.sb
    .from("recados")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error) {
    if (!navigator.onLine) avisar("Sem internet — mostrando dados salvos.");
    else console.error(error);
    return;
  }
  estado.recados = data;
  gravarLocal("recados-cache", data);
  renderTudo();
}

async function inserirRecados(lista) {
  const { data, error } = await estado.sb.from("recados").insert(lista).select();
  if (error) throw error;
  estado.recados = [...data, ...estado.recados];
  gravarLocal("recados-cache", estado.recados);
  renderTudo();
  return data;
}

async function atualizarRecado(id, mudancas) {
  const i = estado.recados.findIndex((r) => r.id === id);
  const antes = estado.recados[i];
  estado.recados[i] = { ...antes, ...mudancas }; // otimista: a tela muda na hora
  renderTudo();
  const { data, error } = await estado.sb.from("recados").update(mudancas).eq("id", id).select().single();
  if (error) {
    estado.recados[i] = antes;
    renderTudo();
    avisar("Não foi possível salvar. Verifique a internet.");
    throw error;
  }
  estado.recados[estado.recados.findIndex((r) => r.id === id)] = data;
  gravarLocal("recados-cache", estado.recados);
}

async function excluirRecado(id) {
  const { error } = await estado.sb.from("recados").delete().eq("id", id);
  if (error) throw error;
  estado.recados = estado.recados.filter((r) => r.id !== id);
  gravarLocal("recados-cache", estado.recados);
  renderTudo();
}

function pessoas() {
  const mapa = new Map();
  for (const r of estado.recados) {
    const nome = (r.remetente || "").trim();
    if (nome && !mapa.has(normalizar(nome))) mapa.set(normalizar(nome), nome);
  }
  return [...mapa.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// ---------- lista ----------
function recadosFiltrados() {
  const { status, prioridade, pessoa, busca } = estado.filtros;
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  return estado.recados.filter((r) => {
    if (status !== "todos" && r.status !== status) return false;
    if (prioridade && r.prioridade !== prioridade) return false;
    if (pessoa && normalizar(r.remetente) !== normalizar(pessoa)) return false;
    if (termos.length) {
      const alvo = normalizar([r.remetente, r.assunto, r.resumo, r.texto_original].join(" "));
      if (!termos.every((t) => alvo.includes(t))) return false;
    }
    return true;
  });
}

function seloPrazo(r) {
  if (!r.prazo) return null;
  const falta = new Date(r.prazo) - Date.now();
  const classe = r.status === "pendente" ? (falta < 0 ? "vencido" : falta < 24 * 36e5 ? "perto" : "") : "";
  return el("span", { class: `selo-prazo ${classe}` }, icone("i-relogio"), falta < 0 && r.status === "pendente" ? `venceu ${textoPrazo(r.prazo)}` : textoPrazo(r.prazo));
}

function cartaoRecado(r) {
  const resolvido = r.status === "resolvido";
  return el(
    "article",
    { class: `recado ${resolvido ? "resolvido" : ""}`, dataset: { prioridade: r.prioridade, id: r.id } },
    el(
      "button",
      {
        class: "marcar",
        type: "button",
        "aria-label": resolvido ? "Marcar como pendente" : "Marcar como resolvido",
        onclick: () => alternarStatus(r.id),
      },
      el("span", {}, icone("i-check")),
    ),
    el(
      "div",
      { class: "corpo", onclick: () => abrirEdicao(r.id) },
      el("div", { class: "linha-1" }, el("span", { class: "quem" }, r.remetente || "Sem remetente"), el("span", {}, hora(r.created_at))),
      el("div", { class: "assunto" }, r.assunto || "(sem assunto)"),
      r.resumo ? el("p", { class: "resumo" }, r.resumo) : null,
      seloPrazo(r),
    ),
  );
}

function renderLista() {
  const lista = $("#lista");
  const itens = recadosFiltrados();
  const pendentes = estado.recados.filter((r) => r.status === "pendente").length;
  $("#contador-pendentes").textContent = pendentes ? `${pendentes} pendente${pendentes > 1 ? "s" : ""}` : "";

  if (!itens.length) {
    const temFiltro = estado.filtros.busca || estado.filtros.pessoa || estado.filtros.prioridade;
    lista.replaceChildren(
      el(
        "div",
        { class: "vazio" },
        estado.recados.length === 0
          ? [el("strong", {}, "Nenhum recado ainda"), "Toque em “Novo” para gravar ou colar o primeiro."]
          : temFiltro
            ? [el("strong", {}, "Nada encontrado"), "Tente outra busca ou limpe os filtros."]
            : estado.filtros.status === "pendente"
              ? [el("strong", {}, "Tudo resolvido 🎉"), "Nenhuma pendência no momento."]
              : [el("strong", {}, "Nada por aqui")],
      ),
    );
    return;
  }

  const grupos = new Map();
  for (const r of itens) {
    const k = chaveDia(r.created_at);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(r);
  }
  const frag = document.createDocumentFragment();
  for (const [, rs] of grupos) {
    rs.sort((a, b) => ORDEM_PRIO[a.prioridade] - ORDEM_PRIO[b.prioridade] || new Date(b.created_at) - new Date(a.created_at));
    frag.append(el("section", { class: "grupo" }, el("h3", {}, rotuloDia(rs[0].created_at)), el("div", { class: "grupo-itens" }, rs.map(cartaoRecado))));
  }
  lista.replaceChildren(frag);
}

function renderPessoas() {
  const nomes = pessoas();
  const sel = $("#filtro-pessoa");
  const atual = estado.filtros.pessoa;
  sel.replaceChildren(el("option", { value: "" }, "Todas as pessoas"), ...nomes.map((n) => el("option", { value: n }, n)));
  sel.value = nomes.includes(atual) ? atual : "";
  $("#lista-pessoas").replaceChildren(...nomes.map((n) => el("option", { value: n })));
}

function renderTudo() {
  renderPessoas();
  renderLista();
  if (!$("#aba-resumo").hidden) renderResumoLocal();
}

async function alternarStatus(id) {
  const r = estado.recados.find((x) => x.id === id);
  if (!r) return;
  const novo = r.status === "pendente" ? "resolvido" : "pendente";
  navigator.vibrate?.(10);
  try {
    await atualizarRecado(id, { status: novo });
    if (novo === "resolvido") avisar("Resolvido ✓", { acao: "Desfazer", ao: () => atualizarRecado(id, { status: "pendente" }) });
  } catch {}
}

// ---------- formulário de recado (usado na revisão e na edição) ----------
function formRecado(dados, numero) {
  const f = el("div", { class: "form-recado" });
  let prioridade = dados.prioridade || "media";
  const prazoInput = el("input", { type: "datetime-local", name: "prazo", value: dados.prazo || "" });
  const botoesPrio = Object.entries(PRIORIDADES).map(([valor, nome]) =>
    el("button", { type: "button", dataset: { valor }, class: valor === prioridade ? "ativo" : "" }, nome),
  );
  botoesPrio.forEach((b) =>
    b.addEventListener("click", () => {
      prioridade = b.dataset.valor;
      botoesPrio.forEach((x) => x.classList.toggle("ativo", x === b));
    }),
  );
  if (numero) f.append(el("div", { class: "num" }, `Recado ${numero}`));
  f.append(
    el("label", {}, "Quem mandou", el("input", { name: "remetente", value: dados.remetente || "", list: "lista-pessoas", autocomplete: "off", autocapitalize: "words" })),
    el("label", {}, "Assunto", el("input", { name: "assunto", value: dados.assunto || "", autocapitalize: "sentences" })),
    el("label", {}, "Resumo", el("textarea", { name: "resumo", rows: 3 }, dados.resumo || "")),
    el(
      "label",
      {},
      "Prazo",
      el("div", { class: "prazo-linha" }, prazoInput, el("button", { type: "button", class: "botao suave", onclick: () => (prazoInput.value = "") }, "Sem prazo")),
    ),
    el("div", { class: "prio-bloco" }, el("label", {}, "Prioridade"), el("div", { class: "prio" }, botoesPrio)),
  );
  f.ler = () => ({
    remetente: $("[name=remetente]", f).value.trim(),
    assunto: $("[name=assunto]", f).value.trim(),
    resumo: $("[name=resumo]", f).value.trim(),
    prazo: deInputLocal(prazoInput.value),
    prioridade,
  });
  return f;
}

// ---------- captura: texto, colar, áudio ----------
const captura = { origem: "texto", textoOriginal: "", forms: [] };
const textoRecado = () => $("#texto-recado");

async function organizar() {
  const texto = textoRecado().value.trim();
  if (!texto) {
    avisar("Cole um texto ou grave um áudio primeiro.");
    return;
  }
  const btn = $("#btn-organizar");
  btn.disabled = true;
  btn.replaceChildren(el("span", { class: "carregando-pontos" }, "Organizando"));
  try {
    const { recados } = await api("extrair", {
      texto,
      pessoas: pessoas(),
      agora: agoraLocal(),
      fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    mostrarRevisao(recados.length ? recados : [{ resumo: texto }], texto);
  } catch (e) {
    avisar(`IA indisponível: ${e.message} Preencha manualmente.`);
    mostrarRevisao([{ resumo: texto }], texto);
  } finally {
    btn.disabled = false;
    btn.replaceChildren("✨ Organizar com IA");
  }
}

function mostrarRevisao(recados, textoOriginal) {
  captura.textoOriginal = textoOriginal;
  captura.forms = recados.map((r, i) => formRecado(r, recados.length > 1 ? i + 1 : 0));
  $("#formularios").replaceChildren(...captura.forms);
  $("#btn-salvar").textContent = recados.length > 1 ? `Salvar ${recados.length} recados` : "Salvar";
  $("#captura").hidden = true;
  $("#revisao").hidden = false;
  window.scrollTo({ top: 0 });
}

function limparCaptura() {
  textoRecado().value = "";
  captura.origem = "texto";
  captura.forms = [];
  $("#formularios").replaceChildren();
  $("#revisao").hidden = true;
  $("#captura").hidden = false;
}

async function salvarCaptura() {
  const btn = $("#btn-salvar");
  const lista = captura.forms.map((f) => ({
    ...f.ler(),
    texto_original: captura.textoOriginal,
    origem: captura.origem,
  }));
  if (lista.some((r) => !r.assunto && !r.resumo)) {
    avisar("Preencha pelo menos o assunto ou o resumo.");
    return;
  }
  btn.disabled = true;
  try {
    await inserirRecados(lista);
    limparCaptura();
    avisar(lista.length > 1 ? `${lista.length} recados salvos ✓` : "Recado salvo ✓");
    irPara("recados");
  } catch (e) {
    console.error(e);
    avisar("Não foi possível salvar. Verifique a internet.");
  } finally {
    btn.disabled = false;
  }
}

async function colar() {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) return avisar("A área de transferência está vazia.");
    textoRecado().value = t.trim();
    captura.origem = "texto";
    organizar();
  } catch {
    textoRecado().focus();
    avisar("Toque e segure no campo e escolha “Colar”.");
  }
}

// Gravação: usa transcrição no servidor (Whisper/Groq) se configurada; senão, o reconhecimento de voz do iPhone.
const gravacao = { ativo: false, reconhecimento: null, gravador: null, partes: [], inicio: 0, timer: null, base: "", final: "" };

function statusMic(texto) {
  $("#mic-status").textContent = texto;
}
function tempoDecorrido() {
  const s = Math.floor((Date.now() - gravacao.inicio) / 1000);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
function iniciarTimer() {
  gravacao.inicio = Date.now();
  statusMic(`Gravando 0:00 — toque para parar`);
  gravacao.timer = setInterval(() => {
    statusMic(`Gravando ${tempoDecorrido()} — toque para parar`);
    if (Date.now() - gravacao.inicio > 180_000) pararGravacao(); // limite de 3 minutos
  }, 500);
}

async function alternarGravacao() {
  if (gravacao.ativo) return pararGravacao();
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (estado.config.transcricaoServidor && window.MediaRecorder) return gravarParaServidor();
  if (Reconhecimento) return reconhecerNoAparelho(Reconhecimento);
  if (window.MediaRecorder) return avisar("Para ditar, toque no campo de texto e use o 🎤 do teclado do iPhone.");
  avisar("Este aparelho não permite gravar aqui. Use o 🎤 do teclado.");
}

async function gravarParaServidor() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return avisar("Permita o acesso ao microfone para gravar.");
  }
  const tipo = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
  const gravador = new MediaRecorder(stream, tipo ? { mimeType: tipo, audioBitsPerSecond: 48000 } : undefined);
  gravacao.partes = [];
  gravador.ondataavailable = (e) => e.data.size && gravacao.partes.push(e.data);
  gravador.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(gravacao.partes, { type: gravador.mimeType || tipo || "audio/mp4" });
    if (blob.size < 1000) return statusMic("Toque para falar");
    $("#btn-mic").classList.add("ocupado");
    statusMic("Transcrevendo…");
    try {
      const base64 = await new Promise((ok, erro) => {
        const leitor = new FileReader();
        leitor.onload = () => ok(String(leitor.result).split(",")[1]);
        leitor.onerror = erro;
        leitor.readAsDataURL(blob);
      });
      const { texto } = await api("transcrever", { audio: base64, tipo: blob.type });
      adicionarTextoFalado(texto);
    } catch (e) {
      avisar(`Falha na transcrição: ${e.message}`);
    } finally {
      $("#btn-mic").classList.remove("ocupado");
      statusMic("Toque para falar");
    }
  };
  gravacao.gravador = gravador;
  gravacao.ativo = true;
  $("#btn-mic").classList.add("gravando");
  gravador.start(1000);
  iniciarTimer();
}

function reconhecerNoAparelho(Reconhecimento) {
  const rec = new Reconhecimento();
  rec.lang = "pt-BR";
  rec.continuous = true;
  rec.interimResults = true;
  gravacao.base = textoRecado().value.trim();
  gravacao.final = "";
  rec.onresult = (e) => {
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) gravacao.final += e.results[i][0].transcript + " ";
      else parcial += e.results[i][0].transcript;
    }
    textoRecado().value = [gravacao.base, (gravacao.final + parcial).trim()].filter(Boolean).join("\n");
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      avisar("Permita o microfone e o reconhecimento de fala em Ajustes do iPhone, ou use o 🎤 do teclado.");
      gravacao.ativo = false;
    } else if (e.error !== "no-speech" && e.error !== "aborted") {
      console.warn("voz", e.error);
    }
  };
  rec.onend = () => {
    // O iPhone às vezes encerra sozinho; se ainda estamos gravando, retoma.
    if (gravacao.ativo) {
      gravacao.base = textoRecado().value.trim();
      gravacao.final = "";
      try {
        rec.start();
        return;
      } catch {}
    }
    finalizarReconhecimento();
  };
  try {
    rec.start();
  } catch {
    return avisar("Não foi possível iniciar o microfone.");
  }
  gravacao.reconhecimento = rec;
  gravacao.ativo = true;
  $("#btn-mic").classList.add("gravando");
  iniciarTimer();
}

function finalizarReconhecimento() {
  clearInterval(gravacao.timer);
  gravacao.ativo = false;
  gravacao.reconhecimento = null;
  $("#btn-mic").classList.remove("gravando");
  statusMic("Toque para falar");
  if (textoRecado().value.trim()) {
    captura.origem = "audio";
    organizar();
  }
}

function pararGravacao() {
  clearInterval(gravacao.timer);
  gravacao.ativo = false;
  $("#btn-mic").classList.remove("gravando");
  if (gravacao.gravador) {
    gravacao.gravador.stop();
    gravacao.gravador = null;
  }
  if (gravacao.reconhecimento) gravacao.reconhecimento.stop(); // onend -> finalizarReconhecimento
}

function adicionarTextoFalado(texto) {
  if (!texto) return avisar("Não entendi o áudio. Tente de novo, mais perto do microfone.");
  const atual = textoRecado().value.trim();
  textoRecado().value = [atual, texto].filter(Boolean).join("\n");
  captura.origem = "audio";
  organizar();
}

// ---------- edição ----------
function abrirEdicao(id) {
  const r = estado.recados.find((x) => x.id === id);
  if (!r) return;
  estado.editando = { id, form: formRecado({ ...r, prazo: paraInputLocal(r.prazo) }) };
  $("#campos-edicao").replaceChildren(estado.editando.form);
  $("#texto-original").textContent = r.texto_original || "—";
  $(".original").hidden = !r.texto_original;
  $("#dlg-editar").showModal();
}

// ---------- resumo do dia ----------
function dadosDoDia() {
  const agora = Date.now();
  const hoje = estado.recados.filter((r) => mesmoDia(r.created_at, new Date()));
  const pendentes = estado.recados.filter((r) => r.status === "pendente");
  const prazos = pendentes
    .filter((r) => r.prazo && new Date(r.prazo) - agora < 7 * 864e5)
    .sort((a, b) => new Date(a.prazo) - new Date(b.prazo));
  const em48h = prazos.filter((r) => new Date(r.prazo) - agora < 48 * 36e5);
  return { hoje, pendentes, prazos, em48h };
}

function renderResumoLocal() {
  const { hoje, pendentes, prazos, em48h } = dadosDoDia();
  $("#data-hoje").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  $("#n-hoje").textContent = hoje.length;
  $("#n-pendentes").textContent = pendentes.length;
  $("#n-prazos").textContent = em48h.length;
  const caixa = $("#prazos-proximos");
  caixa.replaceChildren(
    prazos.length
      ? el("section", { class: "grupo" }, el("h3", {}, "Prazos dos próximos dias"), el("div", { class: "grupo-itens" }, prazos.slice(0, 8).map(cartaoRecado)))
      : "",
  );
}

function markdownSimples(texto) {
  const frag = document.createDocumentFragment();
  let ul = null;
  const inline = (t) => {
    const p = document.createDocumentFragment();
    t.split(/(\*\*[^*]+\*\*)/g).forEach((pedaco) => {
      if (/^\*\*[^*]+\*\*$/.test(pedaco)) p.append(el("strong", {}, pedaco.slice(2, -2)));
      else if (pedaco) p.append(pedaco);
    });
    return p;
  };
  for (const linha of texto.split("\n")) {
    const l = linha.trim();
    if (!l) {
      ul = null;
      continue;
    }
    if (/^#{1,6}\s/.test(l)) {
      ul = null;
      frag.append(el("h4", {}, inline(l.replace(/^#+\s*/, ""))));
    } else if (/^[-*•]\s/.test(l)) {
      if (!ul) frag.append((ul = el("ul")));
      ul.append(el("li", {}, inline(l.replace(/^[-*•]\s*/, ""))));
    } else {
      ul = null;
      frag.append(el("p", {}, inline(l)));
    }
  }
  return frag;
}

function assinaturaDados() {
  return estado.recados.map((r) => `${r.id}:${r.updated_at}`).join("|");
}

async function gerarResumo({ forcar = false } = {}) {
  const caixa = $("#texto-resumo");
  const cache = lerLocal("resumo-cache", null);
  const dia = chaveDia(new Date());
  const assinatura = assinaturaDados();
  if (!forcar && cache && cache.dia === dia && cache.assinatura === assinatura) {
    caixa.replaceChildren(markdownSimples(cache.texto));
    return;
  }
  if (!estado.recados.length) {
    caixa.replaceChildren(el("p", { class: "sub" }, "Ainda não há recados para resumir."));
    return;
  }
  const btn = $("#btn-gerar-resumo");
  btn.disabled = true;
  caixa.replaceChildren(el("p", { class: "sub carregando-pontos" }, "Gerando resumo"));
  const { hoje, pendentes, prazos } = dadosDoDia();
  const compacto = (r) => ({
    remetente: r.remetente,
    assunto: r.assunto,
    resumo: r.resumo,
    prazo: r.prazo ? `${new Date(r.prazo).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} ${hora(r.prazo)}` : "",
    prioridade: r.prioridade,
    status: r.status,
    recebido: rotuloDia(r.created_at),
  });
  try {
    const { resumo } = await api("resumo", {
      agora: agoraLocal(),
      hoje: hoje.slice(0, 80).map(compacto),
      pendentes: pendentes.sort((a, b) => ORDEM_PRIO[a.prioridade] - ORDEM_PRIO[b.prioridade]).slice(0, 80).map(compacto),
      prazos: prazos.slice(0, 40).map(compacto),
    });
    gravarLocal("resumo-cache", { dia, assinatura, texto: resumo });
    caixa.replaceChildren(markdownSimples(resumo));
  } catch (e) {
    caixa.replaceChildren(el("p", { class: "msg erro" }, `Não foi possível gerar o resumo: ${e.message}`));
  } finally {
    btn.disabled = false;
  }
}

// ---------- notificações push ----------
function base64UrlParaBytes(base64) {
  const p = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
const ehIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const instalado = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

async function atualizarPushUI() {
  const btn = $("#btn-push");
  const info = $("#push-info");
  $("#cartao-instalar").hidden = instalado;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    btn.hidden = true;
    info.textContent = ehIOS && !instalado
      ? "Para receber lembretes, primeiro adicione o app à Tela de Início (veja abaixo) e abra-o pelo ícone."
      : "Este navegador não suporta notificações. No iPhone, é preciso iOS 16.4 ou mais recente.";
    return;
  }
  if (!estado.config.vapidPublicKey) {
    btn.hidden = true;
    info.textContent = "Lembretes ainda não configurados no servidor (VAPID_PUBLIC_KEY).";
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const inscricao = await reg.pushManager.getSubscription();
  btn.hidden = false;
  if (Notification.permission === "denied") {
    info.textContent = "As notificações estão bloqueadas. Libere em Ajustes do iPhone → Notificações → Recados.";
    btn.hidden = true;
  } else if (inscricao) {
    info.textContent = "✅ Lembretes ativos neste aparelho. Você será avisado antes de cada prazo.";
    btn.textContent = "Desativar lembretes";
    btn.className = "botao suave";
  } else {
    info.textContent = "Receba um aviso no iPhone antes do prazo de cada recado.";
    btn.textContent = "Ativar lembretes";
    btn.className = "botao primario";
  }
  $("#btn-push-teste").hidden = !inscricao;
}

async function alternarPush() {
  const reg = await navigator.serviceWorker.ready;
  const existente = await reg.pushManager.getSubscription();
  try {
    if (existente) {
      await estado.sb.from("push_subscriptions").delete().eq("endpoint", existente.endpoint);
      await existente.unsubscribe();
      avisar("Lembretes desativados.");
    } else {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") return avisar("Sem permissão, não dá para enviar lembretes.");
      const insc = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlParaBytes(estado.config.vapidPublicKey),
      });
      const j = insc.toJSON();
      const { error } = await estado.sb
        .from("push_subscriptions")
        .upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      avisar("Lembretes ativados ✓");
    }
  } catch (e) {
    console.error(e);
    avisar(`Não foi possível alterar os lembretes: ${e.message}`);
  }
  atualizarPushUI();
}

async function testarNotificacao() {
  const reg = await navigator.serviceWorker.ready;
  reg.showNotification("Recados", { body: "Assim aparecerão os lembretes de prazo. 👍", icon: "/icons/icon-192.png" });
}

// ---------- navegação ----------
function irPara(aba) {
  $$(".aba").forEach((s) => (s.hidden = s.id !== `aba-${aba}`));
  $$(".barra-abas button").forEach((b) => b.classList.toggle("ativo", b.dataset.aba === aba));
  window.scrollTo({ top: 0 });
  if (aba === "resumo") {
    renderResumoLocal();
    gerarResumo();
  }
  if (aba === "ajustes") atualizarPushUI();
}

function abrirPelaUrl(url) {
  const id = new URL(url, location.href).searchParams.get("recado");
  if (!id) return;
  history.replaceState(null, "", "/");
  irPara("recados");
  setTimeout(() => abrirEdicao(id), 50);
}

// ---------- login ----------
function mostrarTela(qual) {
  $("#tela-carregando").hidden = qual !== "carregando";
  $("#tela-config").hidden = qual !== "config";
  $("#tela-login").hidden = qual !== "login";
  $("#app").hidden = qual !== "app";
}

async function entrar(e) {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const senha = $("#login-senha").value;
  const msg = $("#login-msg");
  const btn = $("#btn-entrar");
  msg.className = "msg";
  msg.textContent = "";
  btn.disabled = true;
  try {
    if (estado.criarConta) {
      const { data, error } = await estado.sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin } });
      if (error) throw error;
      if (!data.session) {
        msg.textContent = "Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre aqui com sua senha.";
        alternarModoLogin(false);
      }
    } else {
      const { error } = await estado.sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
    }
  } catch (err) {
    msg.className = "msg erro";
    const m = String(err.message || err);
    msg.textContent = /invalid login/i.test(m)
      ? "E-mail ou senha incorretos."
      : /not confirmed/i.test(m)
        ? "Confirme seu e-mail pelo link que enviamos antes de entrar."
        : /signups not allowed|signup is disabled/i.test(m)
          ? "Novos cadastros estão desativados."
          : m;
  } finally {
    btn.disabled = false;
  }
}

function alternarModoLogin(criar = !estado.criarConta) {
  estado.criarConta = criar;
  $("#btn-entrar").textContent = criar ? "Criar conta" : "Entrar";
  $("#btn-alternar-login").textContent = criar ? "Já tenho conta — entrar" : "Ainda não tenho conta — criar";
  $("#login-senha").autocomplete = criar ? "new-password" : "current-password";
}

async function aoMudarSessao(sessao) {
  const usuario = sessao?.user || null;
  const mudou = usuario?.id !== estado.usuario?.id;
  estado.usuario = usuario;
  if (!usuario) {
    estado.recados = [];
    gravarLocal("recados-cache", []);
    localStorage.removeItem("resumo-cache");
    mostrarTela("login");
    return;
  }
  $("#conta-email").textContent = usuario.email;
  mostrarTela("app");
  if (mudou) {
    renderTudo();
    await carregarRecados();
    abrirPelaUrl(location.href);
  }
}

// ---------- eventos ----------
function ligarEventos() {
  $("#form-login").addEventListener("submit", entrar);
  $("#btn-alternar-login").addEventListener("click", () => alternarModoLogin());

  $$(".barra-abas button").forEach((b) => b.addEventListener("click", () => irPara(b.dataset.aba)));

  let timerBusca;
  $("#busca").addEventListener("input", (e) => {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => {
      estado.filtros.busca = e.target.value;
      // Ao buscar, procura em todos os status
      if (e.target.value && estado.filtros.status === "pendente") definirStatusFiltro("todos");
      renderLista();
    }, 120);
  });
  $$("#filtro-status button").forEach((b) => b.addEventListener("click", () => definirStatusFiltro(b.dataset.valor)));
  $("#filtro-prioridade").addEventListener("change", (e) => {
    estado.filtros.prioridade = e.target.value;
    renderLista();
  });
  $("#filtro-pessoa").addEventListener("change", (e) => {
    estado.filtros.pessoa = e.target.value;
    renderLista();
  });

  $("#btn-colar").addEventListener("click", colar);
  $("#btn-limpar").addEventListener("click", () => {
    textoRecado().value = "";
    textoRecado().focus();
  });
  textoRecado().addEventListener("paste", () => {
    // Colou direto no campo? Organiza sozinho.
    captura.origem = "texto";
    setTimeout(() => textoRecado().value.trim() && organizar(), 150);
  });
  $("#btn-mic").addEventListener("click", alternarGravacao);
  $("#btn-organizar").addEventListener("click", organizar);
  $("#btn-manual").addEventListener("click", () => {
    captura.origem = textoRecado().value.trim() ? captura.origem : "manual";
    mostrarRevisao([{ resumo: textoRecado().value.trim() }], textoRecado().value.trim());
  });
  $("#btn-descartar").addEventListener("click", () => {
    $("#revisao").hidden = true;
    $("#captura").hidden = false;
  });
  $("#btn-salvar").addEventListener("click", salvarCaptura);

  $("#form-editar").addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "salvar" || !estado.editando) return;
    const { id, form } = estado.editando;
    try {
      await atualizarRecado(id, form.ler());
      avisar("Alterações salvas ✓");
    } catch {}
  });
  $("#btn-cancelar-edicao").addEventListener("click", () => $("#dlg-editar").close());
  $("#btn-excluir").addEventListener("click", async () => {
    if (!estado.editando || !confirm("Excluir este recado?")) return;
    try {
      await excluirRecado(estado.editando.id);
      $("#dlg-editar").close();
      avisar("Recado excluído.");
    } catch {
      avisar("Não foi possível excluir.");
    }
  });
  $("#dlg-editar").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close(); // toque fora fecha
  });

  $("#btn-gerar-resumo").addEventListener("click", () => gerarResumo({ forcar: true }));
  $("#btn-push").addEventListener("click", alternarPush);
  $("#btn-push-teste").addEventListener("click", testarNotificacao);
  $$("#tema button").forEach((b) =>
    b.addEventListener("click", () => {
      gravarLocal("tema", b.dataset.valor);
      aplicarTema(b.dataset.valor);
    }),
  );
  $("#btn-sair").addEventListener("click", async () => {
    if (confirm("Sair da conta neste aparelho?")) await estado.sb.auth.signOut();
  });

  // Sincroniza quando o app volta para a frente (ex.: usou em outro aparelho)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && estado.usuario) carregarRecados();
  });
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.tipo === "abrir") abrirPelaUrl(e.data.url);
  });
}

function definirStatusFiltro(valor) {
  estado.filtros.status = valor;
  $$("#filtro-status button").forEach((b) => b.classList.toggle("ativo", b.dataset.valor === valor));
  renderLista();
}

// ---------- início ----------
async function iniciar() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(console.error);
  ligarEventos();

  try {
    estado.config = await fetch("/api/config").then((r) => r.json());
    gravarLocal("config-cache", estado.config);
  } catch {
    estado.config = lerLocal("config-cache", null); // offline
  }
  if (!estado.config || !estado.config.supabaseUrl || !estado.config.supabaseKey) {
    const faltando = estado.config?.faltando || ["SUPABASE_URL", "SUPABASE_PUBLIC_KEY"];
    $("#lista-faltando").replaceChildren(...faltando.map((n) => el("li", {}, n)));
    mostrarTela("config");
    return;
  }

  estado.sb = createClient(estado.config.supabaseUrl, estado.config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  estado.sb.auth.onAuthStateChange((_evento, sessao) => {
    // Evita chamar o Supabase dentro do callback (recomendação da biblioteca)
    setTimeout(() => aoMudarSessao(sessao), 0);
  });
  const { data } = await estado.sb.auth.getSession();
  await aoMudarSessao(data.session);
}

iniciar();
