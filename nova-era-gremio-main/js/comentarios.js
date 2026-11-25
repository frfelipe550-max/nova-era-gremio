(function () {
  "use strict";

  const client = window.novaEraSupabase;
  const AUTH_SESSION_KEY = "nova_era_admin_unlocked"; // legado; autenticação real usa Supabase Auth.
  const TABLE = "comentarios";
  let maxLength = 500;
  let realtimeChannel = null;

  function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function generateCommentId() {
    return `comentario-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function fetchConfig() {
    const response = await fetch("./data/config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Não foi possível carregar a configuração (HTTP ${response.status}).`);
    return response.json();
  }

  function requireClient() {
    if (!client) throw new Error("Supabase não foi inicializado. Confira os scripts em index.html e admin.html.");
    return client;
  }

  function normalizeRow(row) {
    return {
      id: String(row.id),
      nome: row.nome || "",
      turma: row.turma || "",
      mensagem: row.mensagem || "",
      data: row.data || getTodayISO(),
      resposta: row.resposta && row.resposta.texto ? row.resposta : null
    };
  }

  async function getMergedComments() {
    try {
      const { data, error } = await requireClient()
        .from(TABLE)
        .select("id,nome,turma,mensagem,data,resposta")
        .order("data", { ascending: false })
        .order("id", { ascending: false });
      if (error) throw error;
      return { comentarios: (data || []).map(normalizeRow), baseCount: (data || []).length, pendingSyncCount: 0, fetchError: null };
    } catch (fetchError) {
      return { comentarios: [], baseCount: 0, pendingSyncCount: 0, fetchError };
    }
  }

  async function addComment({ nome, turma, mensagem }) {
    const clean = {
      id: generateCommentId(),
      nome: String(nome || "").trim(),
      turma: String(turma || "").trim(),
      mensagem: String(mensagem || "").trim(),
      data: getTodayISO(),
      resposta: null
    };
    const { data, error } = await requireClient().from(TABLE).insert(clean).select().single();
    if (error) throw error;
    return normalizeRow(data);
  }

  async function saveReply(commentId, textoResposta, dataResposta) {
    const resposta = textoResposta ? { texto: textoResposta.trim(), data: dataResposta || getTodayISO() } : null;
    const { data, error } = await requireClient().from(TABLE).update({ resposta }).eq("id", commentId).select().single();
    if (error) throw error;
    return normalizeRow(data);
  }

  async function updateComment(commentId, fields) {
    const update = {
      nome: String(fields.nome || "").trim(),
      turma: String(fields.turma || "").trim(),
      data: fields.data,
      mensagem: String(fields.mensagem || "").trim()
    };
    const { data, error } = await requireClient().from(TABLE).update(update).eq("id", commentId).select().single();
    if (error) throw error;
    return normalizeRow(data);
  }

  async function deleteComment(commentId) {
    const { error } = await requireClient().from(TABLE).delete().eq("id", commentId);
    if (error) throw error;
  }

  async function importCommentsArray(items) {
    const rows = items.map((item) => ({
      id: String(item.id || generateCommentId()),
      nome: String(item.nome || "").trim(),
      turma: String(item.turma || "").trim(),
      mensagem: String(item.mensagem || "").trim(),
      data: String(item.data || getTodayISO()),
      resposta: item.resposta && item.resposta.texto
        ? { texto: String(item.resposta.texto).trim(), data: String(item.resposta.data || getTodayISO()) }
        : null
    }));
    if (!rows.length) return;
    const { error } = await requireClient().from(TABLE).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  function resetLocalChanges() {
    // Não há mais alterações locais: o banco é a fonte oficial.
    return true;
  }

  async function buildExportJSONString() {
    const result = await getMergedComments();
    if (result.fetchError) throw result.fetchError;
    return JSON.stringify({ comentarios: result.comentarios }, null, 2);
  }

  function formatDateBR(isoDate) {
    if (!isoDate || typeof isoDate !== "string") return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  window.NovaEraComentariosService = {
    AUTH_SESSION_KEY, fetchConfig, getMergedComments, addComment, saveReply,
    updateComment, deleteComment, importCommentsArray, resetLocalChanges,
    buildExportJSONString, getTodayISO, formatDateBR
  };

  async function initPublicComments() {
    const form = document.getElementById("form-comentario");
    const list = document.getElementById("comentarios-lista");
    if (!form || !list) return;

    try {
      const cfg = await fetchConfig();
      maxLength = Number(cfg?.comentariosConfig?.tamanhoMaximoMensagem) || 500;
    } catch (error) {
      console.warn(error);
    }

    const nomeInput = document.getElementById("comentario-nome");
    const turmaInput = document.getElementById("comentario-turma");
    const msgInput = document.getElementById("comentario-mensagem");
    const counter = document.getElementById("comentario-contador");
    const feedback = document.getElementById("comentario-feedback");

    if (msgInput) {
      msgInput.maxLength = maxLength;
      const updateCounter = () => { if (counter) counter.textContent = `${msgInput.value.length} / ${maxLength}`; };
      msgInput.addEventListener("input", updateCounter);
      updateCounter();
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearFieldErrors();
      if (feedback) { feedback.className = "form-feedback"; feedback.textContent = ""; }

      const nome = (nomeInput?.value || "").trim();
      const turma = (turmaInput?.value || "").trim();
      const mensagem = (msgInput?.value || "").trim();
      let valid = true;
      if (!nome) { setFieldError("comentario-nome", "erro-nome", "Por favor, informe seu nome."); valid = false; }
      if (!turma) { setFieldError("comentario-turma", "erro-turma", "Informe sua turma (ex.: 2º A)."); valid = false; }
      if (!mensagem) { setFieldError("comentario-mensagem", "erro-mensagem", "Escreva seu comentário ou sugestão antes de enviar."); valid = false; }
      else if (mensagem.length > maxLength) { setFieldError("comentario-mensagem", "erro-mensagem", `O comentário deve ter no máximo ${maxLength} caracteres.`); valid = false; }
      if (!valid) { form.querySelector(".invalid")?.focus(); return; }

      const submit = form.querySelector('[type="submit"]');
      if (submit) { submit.disabled = true; submit.textContent = "Enviando..."; }
      try {
        await addComment({ nome, turma, mensagem });
        form.reset();
        if (counter) counter.textContent = `0 / ${maxLength}`;
        if (feedback) {
          feedback.className = "form-feedback show success";
          feedback.textContent = "Manifestação enviada e compartilhada com todos os visitantes.";
        }
        window.NovaEraApp?.showToast("Manifestação enviada com sucesso!", "success");
        await renderPublicList();
      } catch (error) {
        console.error(error);
        if (feedback) {
          feedback.className = "form-feedback show error";
          feedback.textContent = "Não foi possível enviar. Verifique sua conexão e tente novamente.";
        }
        window.NovaEraApp?.showToast("Erro ao enviar manifestação. Confira a configuração do Supabase.", "error");
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = "Enviar comentário"; }
      }
    });

    await renderPublicList();
    // Atualiza a lista em tempo real quando outro visitante envia uma manifestação.
    try {
      if (client && !realtimeChannel) {
        realtimeChannel = client.channel("nova-era-comentarios-publicos")
          .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, renderPublicList)
          .subscribe();
      }
    } catch (error) { console.warn("Atualização em tempo real indisponível:", error); }
  }

  function setFieldError(inputId, errorId, message) {
    document.getElementById(inputId)?.classList.add("invalid");
    const error = document.getElementById(errorId);
    if (error) error.textContent = message;
  }

  function clearFieldErrors() {
    document.querySelectorAll("#form-comentario .invalid").forEach((el) => el.classList.remove("invalid"));
    document.querySelectorAll("#form-comentario .field-error").forEach((el) => { el.textContent = ""; });
  }

  async function renderPublicList() {
    const list = document.getElementById("comentarios-lista");
    const total = document.getElementById("comentarios-total");
    const status = document.getElementById("comentarios-status");
    if (!list) return;

    const result = await getMergedComments();
    const comments = result.comentarios;
    if (result.fetchError) {
      if (status) {
        status.className = "status-message is-error";
        status.textContent = "Não foi possível carregar as manifestações. Confira a conexão e as configurações do Supabase.";
      }
      list.innerHTML = '<div class="empty-state">Não foi possível carregar as manifestações agora.</div>';
      if (total) total.textContent = "Falha ao carregar manifestações";
      return;
    }
    if (status) { status.className = "status-message"; status.textContent = ""; }
    if (total) total.textContent = comments.length === 1 ? "1 manifestação exibida" : `${comments.length} manifestações exibidas`;
    list.innerHTML = "";
    if (!comments.length) {
      list.innerHTML = '<div class="empty-state">Ainda não há manifestações registradas. Seja o primeiro estudante a participar!</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    comments.forEach((item) => {
      const card = document.createElement("article");
      card.className = "comentario-card";
      card.dataset.id = item.id;
      const header = document.createElement("div"); header.className = "comentario-header";
      const autor = document.createElement("div"); autor.className = "comentario-autor";
      const nome = document.createElement("span"); nome.className = "comentario-nome"; nome.textContent = item.nome;
      const turma = document.createElement("span"); turma.className = "comentario-turma"; turma.textContent = item.turma;
      autor.append(nome, turma);
      const data = document.createElement("time"); data.className = "comentario-data"; data.dateTime = item.data; data.textContent = formatDateBR(item.data);
      header.append(autor, data);
      const texto = document.createElement("p"); texto.className = "comentario-texto"; texto.textContent = item.mensagem;
      card.append(header, texto);
      if (item.resposta?.texto) {
        const box = document.createElement("div"); box.className = "resposta-oficial";
        const respHeader = document.createElement("div"); respHeader.className = "resposta-header";
        const badge = document.createElement("span"); badge.className = "resposta-badge"; badge.textContent = "Resposta Oficial — Chapa Nova Era";
        const respData = document.createElement("time"); respData.className = "resposta-data"; respData.dateTime = item.resposta.data || ""; respData.textContent = item.resposta.data ? formatDateBR(item.resposta.data) : "";
        respHeader.append(badge, respData);
        const respText = document.createElement("p"); respText.className = "resposta-texto"; respText.textContent = item.resposta.texto;
        box.append(respHeader, respText); card.appendChild(box);
      }
      fragment.appendChild(card);
    });
    list.appendChild(fragment);
  }

  document.addEventListener("DOMContentLoaded", initPublicComments);
})();
