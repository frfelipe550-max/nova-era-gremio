(function () {
  "use strict";

  const STORAGE_KEY = "nova_era_comentarios_delta_v1";
  const AUTH_SESSION_KEY = "nova_era_admin_unlocked";

  function getEmptyDelta() {
    return {
      added: [],
      overrides: {},
      deleted: []
    };
  }

  function readDelta() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getEmptyDelta();
      const parsed = JSON.parse(raw);
      return {
        added: Array.isArray(parsed.added) ? parsed.added : [],
        overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        deleted: Array.isArray(parsed.deleted) ? parsed.deleted : []
      };
    } catch {
      return getEmptyDelta();
    }
  }

  function writeDelta(delta) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(delta));
  }

  function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function generateCommentId() {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    return `comentario-${stamp}-${rand}`;
  }

  async function fetchBaseComments() {
    const response = await fetch("./data/comentarios.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.comentarios) ? data.comentarios : [];
  }

  async function fetchConfig() {
    const response = await fetch("./data/config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function getMergedComments() {
    let baseList = [];
    let fetchError = null;

    try {
      baseList = await fetchBaseComments();
    } catch (err) {
      fetchError = err;
    }

    const delta = readDelta();
    const baseIds = new Set(baseList.map((c) => c.id));
    const deletedSet = new Set(delta.deleted);

    const cleanedAdded = delta.added.filter((c) => !baseIds.has(c.id));
    if (cleanedAdded.length !== delta.added.length) {
      delta.added = cleanedAdded;
      writeDelta(delta);
    }

    const merged = [];

    baseList.forEach((baseItem) => {
      if (deletedSet.has(baseItem.id)) return;
      const override = delta.overrides[baseItem.id];
      if (override) {
        merged.push({ ...override, _isLocalModified: true });
      } else {
        merged.push({ ...baseItem });
      }
    });

    delta.added.forEach((localItem) => {
      merged.push({ ...localItem, _isLocal: true });
    });

    merged.sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    return {
      comentarios: merged,
      baseCount: baseList.length,
      pendingSyncCount:
        delta.added.length + Object.keys(delta.overrides).length + delta.deleted.length,
      fetchError
    };
  }

  async function addComment({ nome, turma, mensagem }) {
    const delta = readDelta();
    const novo = {
      id: generateCommentId(),
      nome: nome.trim(),
      turma: turma.trim(),
      mensagem: mensagem.trim(),
      data: getTodayISO(),
      resposta: null
    };
    delta.added.unshift(novo);
    writeDelta(delta);
    return novo;
  }

  async function saveReply(commentId, textoResposta, dataResposta) {
    const { comentarios } = await getMergedComments();
    const target = comentarios.find((c) => c.id === commentId);
    if (!target) throw new Error("Comentário não encontrado.");

    const cleanTarget = stripInternalFlags(target);
    cleanTarget.resposta = textoResposta
      ? {
          texto: textoResposta.trim(),
          data: dataResposta || getTodayISO()
        }
      : null;

    await upsertLocalChange(cleanTarget);
    return cleanTarget;
  }

  async function updateComment(commentId, updatedFields) {
    const { comentarios } = await getMergedComments();
    const target = comentarios.find((c) => c.id === commentId);
    if (!target) throw new Error("Comentário não encontrado.");

    const cleanTarget = stripInternalFlags(target);
    cleanTarget.nome = updatedFields.nome.trim();
    cleanTarget.turma = updatedFields.turma.trim();
    cleanTarget.data = updatedFields.data;
    cleanTarget.mensagem = updatedFields.mensagem.trim();

    await upsertLocalChange(cleanTarget);
    return cleanTarget;
  }

  async function deleteComment(commentId) {
    let baseIds = new Set();
    try {
      const base = await fetchBaseComments();
      baseIds = new Set(base.map((c) => c.id));
    } catch {
      // ignora se offline
    }

    const delta = readDelta();
    delta.added = delta.added.filter((c) => c.id !== commentId);
    delete delta.overrides[commentId];

    if (baseIds.has(commentId) && !delta.deleted.includes(commentId)) {
      delta.deleted.push(commentId);
    }

    writeDelta(delta);
  }

  async function upsertLocalChange(cleanComment) {
    const delta = readDelta();
    const addedIndex = delta.added.findIndex((c) => c.id === cleanComment.id);
    if (addedIndex !== -1) {
      delta.added[addedIndex] = cleanComment;
    } else {
      delta.overrides[cleanComment.id] = cleanComment;
    }
    writeDelta(delta);
  }

  async function importCommentsArray(importedList) {
    let baseList = [];
    try {
      baseList = await fetchBaseComments();
    } catch {
      baseList = [];
    }

    const baseMap = new Map(baseList.map((c) => [c.id, c]));
    const importedIds = new Set();
    const nextDelta = getEmptyDelta();

    importedList.forEach((rawItem) => {
      const item = normalizeImportedItem(rawItem);
      importedIds.add(item.id);

      if (!baseMap.has(item.id)) {
        nextDelta.added.push(item);
      } else {
        const baseClean = JSON.stringify(normalizeImportedItem(baseMap.get(item.id)));
        const itemClean = JSON.stringify(item);
        if (baseClean !== itemClean) {
          nextDelta.overrides[item.id] = item;
        }
      }
    });

    baseList.forEach((baseItem) => {
      if (!importedIds.has(baseItem.id)) {
        nextDelta.deleted.push(baseItem.id);
      }
    });

    writeDelta(nextDelta);
  }

  function normalizeImportedItem(item) {
    return {
      id: String(item.id || generateCommentId()),
      nome: String(item.nome || "").trim(),
      turma: String(item.turma || "").trim(),
      mensagem: String(item.mensagem || "").trim(),
      data: String(item.data || getTodayISO()),
      resposta:
        item.resposta && item.resposta.texto
          ? {
              texto: String(item.resposta.texto).trim(),
              data: String(item.resposta.data || getTodayISO())
            }
          : null
    };
  }

  function stripInternalFlags(comment) {
    const copy = { ...comment };
    delete copy._isLocal;
    delete copy._isLocalModified;
    return copy;
  }

  function resetLocalChanges() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function buildExportJSONString() {
    const { comentarios } = await getMergedComments();
    const clean = comentarios.map(stripInternalFlags);
    return JSON.stringify({ comentarios: clean }, null, 2);
  }

  function formatDateBR(isoDate) {
    if (!isoDate || typeof isoDate !== "string") return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  window.NovaEraComentariosService = {
    AUTH_SESSION_KEY,
    fetchConfig,
    getMergedComments,
    addComment,
    saveReply,
    updateComment,
    deleteComment,
    importCommentsArray,
    resetLocalChanges,
    buildExportJSONString,
    getTodayISO,
    formatDateBR
  };

  let maxLength = 500;
  let adminPassword = null;

  async function initPublicComments() {
    const form = document.getElementById("form-comentario");
    const listaEl = document.getElementById("comentarios-lista");
    if (!form || !listaEl) return;

    try {
      const cfg = await fetchConfig();
      if (cfg?.comentariosConfig?.tamanhoMaximoMensagem) {
        maxLength = Number(cfg.comentariosConfig.tamanhoMaximoMensagem) || 500;
      }
      adminPassword = cfg?.administracao?.senhaVisual || null;
    } catch {
      // usa padrão
    }

    const inputNome = document.getElementById("comentario-nome");
    const inputTurma = document.getElementById("comentario-turma");
    const inputMsg = document.getElementById("comentario-mensagem");
    const counterEl = document.getElementById("comentario-contador");
    const feedbackEl = document.getElementById("comentario-feedback");

    if (inputMsg) {
      inputMsg.maxLength = maxLength;
      const updateCounter = () => {
        if (counterEl) {
          counterEl.textContent = `${inputMsg.value.length} / ${maxLength}`;
        }
      };
      inputMsg.addEventListener("input", updateCounter);
      updateCounter();
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearFieldErrors();
      if (feedbackEl) {
        feedbackEl.className = "form-feedback";
        feedbackEl.textContent = "";
      }

      const nome = (inputNome?.value || "").trim();
      const turma = (inputTurma?.value || "").trim();
      const mensagem = (inputMsg?.value || "").trim();

      let valid = true;

      if (!nome) {
        setFieldError("comentario-nome", "erro-nome", "Por favor, informe seu nome.");
        valid = false;
      }
      if (!turma) {
        setFieldError("comentario-turma", "erro-turma", "Informe sua turma (ex.: 2º A).");
        valid = false;
      }
      if (!mensagem) {
        setFieldError("comentario-mensagem", "erro-mensagem", "Escreva seu comentário ou sugestão antes de enviar.");
        valid = false;
      } else if (mensagem.length > maxLength) {
        setFieldError("comentario-mensagem", "erro-mensagem", `O comentário deve ter no máximo ${maxLength} caracteres.`);
        valid = false;
      }

      if (!valid) {
        form.querySelector(".invalid")?.focus();
        return;
      }

      await addComment({ nome, turma, mensagem });
      form.reset();
      if (counterEl) counterEl.textContent = `0 / ${maxLength}`;

      if (feedbackEl) {
        feedbackEl.className = "form-feedback show success";
        feedbackEl.textContent =
          "Comentário registrado neste navegador! Após moderação e atualização do arquivo oficial pela equipe Nova Era, ele ficará visível para todos os estudantes.";
      }

      window.NovaEraApp?.showToast("Comentário salvo localmente com sucesso!", "success");
      await renderPublicList();
    });

    await renderPublicList();
  }

  function setFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(errorId);
    if (input) input.classList.add("invalid");
    if (err) err.textContent = message;
  }

  function clearFieldErrors() {
    document.querySelectorAll("#form-comentario .invalid").forEach((el) => el.classList.remove("invalid"));
    document.querySelectorAll("#form-comentario .field-error").forEach((el) => {
      el.textContent = "";
    });
  }

  async function renderPublicList() {
    const listaEl = document.getElementById("comentarios-lista");
    const totalEl = document.getElementById("comentarios-total");
    const statusEl = document.getElementById("comentarios-status");
    if (!listaEl) return;

    const { comentarios, fetchError } = await getMergedComments();

    if (fetchError && statusEl) {
      statusEl.className = "status-message";
      statusEl.textContent =
        "Aviso: não foi possível ler data/comentarios.json (abra via servidor local ou GitHub Pages para ver os comentários publicados). Manifestações locais continuam funcionando.";
    } else if (statusEl) {
      statusEl.textContent = "";
      statusEl.className = "status-message";
    }

    if (totalEl) {
      totalEl.textContent =
        comentarios.length === 1
          ? "1 manifestação exibida"
          : `${comentarios.length} manifestações exibidas`;
    }

    listaEl.innerHTML = "";

    if (comentarios.length === 0) {
      listaEl.innerHTML = `<div class="empty-state">Ainda não há manifestações registradas. Seja o primeiro estudante a participar!</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    comentarios.forEach((item) => {
      const card = document.createElement("article");
      card.className = `comentario-card${item._isLocal || item._isLocalModified ? " is-local" : ""}`;
      card.dataset.id = item.id;

      const header = document.createElement("div");
      header.className = "comentario-header";

      const autor = document.createElement("div");
      autor.className = "comentario-autor";

      const nome = document.createElement("span");
      nome.className = "comentario-nome";
      nome.textContent = item.nome;

      const turma = document.createElement("span");
      turma.className = "comentario-turma";
      turma.textContent = item.turma;

      autor.append(nome, turma);

      if (item._isLocal) {
        const badgeLocal = document.createElement("span");
        badgeLocal.className = "comentario-local-badge";
        badgeLocal.textContent = "Salvo localmente • aguardando publicação";
        autor.appendChild(badgeLocal);
      } else if (item._isLocalModified) {
        const badgeEdit = document.createElement("span");
        badgeEdit.className = "comentario-local-badge";
        badgeEdit.textContent = "Alterado localmente";
        autor.appendChild(badgeEdit);
      }

      const data = document.createElement("time");
      data.className = "comentario-data";
      data.dateTime = item.data;
      data.textContent = formatDateBR(item.data);

      header.append(autor, data);

      const texto = document.createElement("p");
      texto.className = "comentario-texto";
      texto.textContent = item.mensagem;

      card.append(header, texto);

      if (item.resposta && item.resposta.texto) {
        const respBox = document.createElement("div");
        respBox.className = "resposta-oficial";

        const respHeader = document.createElement("div");
        respHeader.className = "resposta-header";

        const respBadge = document.createElement("span");
        respBadge.className = "resposta-badge";
        respBadge.textContent = "Resposta Oficial — Chapa Nova Era";

        const respData = document.createElement("time");
        respData.className = "resposta-data";
        respData.dateTime = item.resposta.data || "";
        respData.textContent = item.resposta.data ? formatDateBR(item.resposta.data) : "";

        respHeader.append(respBadge, respData);

        const respTexto = document.createElement("p");
        respTexto.className = "resposta-texto";
        respTexto.textContent = item.resposta.texto;

        respBox.append(respHeader, respTexto);
        card.appendChild(respBox);
      }

      const footer = document.createElement("div");
      footer.className = "comentario-footer";

      const btnResponder = document.createElement("button");
      btnResponder.type = "button";
      btnResponder.className = "btn-responder";
      btnResponder.textContent = item.resposta?.texto ? "Editar resposta (Nova Era)" : "Responder";
      btnResponder.addEventListener("click", () => toggleInlineReply(card, item));

      footer.appendChild(btnResponder);
      card.appendChild(footer);

      fragment.appendChild(card);
    });

    listaEl.appendChild(fragment);
  }

  function toggleInlineReply(card, item) {
    const existing = card.querySelector(".inline-reply-box");
    if (existing) {
      existing.remove();
      return;
    }

    const box = document.createElement("div");
    box.className = "inline-reply-box";

    const isUnlocked = sessionStorage.getItem(AUTH_SESSION_KEY) === "true";

    if (!isUnlocked && adminPassword) {
      const note = document.createElement("p");
      note.className = "inline-reply-note";
      note.textContent =
        "Espaço reservado para resposta oficial da chapa Nova Era. Digite a senha da equipe (barreira visual configurada em config.json):";

      const passInput = document.createElement("input");
      passInput.type = "password";
      passInput.placeholder = "Senha da equipe Nova Era";
      passInput.setAttribute("aria-label", "Senha da equipe Nova Era");

      const errorEl = document.createElement("span");
      errorEl.className = "field-error";

      const actions = document.createElement("div");
      actions.className = "inline-reply-actions";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-secondary btn-sm";
      cancelBtn.textContent = "Cancelar";
      cancelBtn.addEventListener("click", () => box.remove());

      const unlockBtn = document.createElement("button");
      unlockBtn.type = "button";
      unlockBtn.className = "btn btn-primary btn-sm";
      unlockBtn.textContent = "Desbloquear resposta";
      unlockBtn.addEventListener("click", () => {
        if (passInput.value === adminPassword) {
          sessionStorage.setItem(AUTH_SESSION_KEY, "true");
          box.remove();
          toggleInlineReply(card, item);
        } else {
          errorEl.textContent = "Senha incorreta.";
        }
      });

      actions.append(cancelBtn, unlockBtn);
      box.append(note, passInput, errorEl, actions);
      card.appendChild(box);
      passInput.focus();
      return;
    }

    const note = document.createElement("p");
    note.className = "inline-reply-note";
    note.textContent =
      "A resposta abaixo será salva localmente. Para publicar para todos, exporte o comentarios.json no Painel Administrativo.";

    const textarea = document.createElement("textarea");
    textarea.rows = 3;
    textarea.maxLength = 800;
    textarea.placeholder = "Escreva a resposta oficial da chapa Nova Era...";
    textarea.value = item.resposta?.texto || "";

    const errorEl = document.createElement("span");
    errorEl.className = "field-error";

    const actions = document.createElement("div");
    actions.className = "inline-reply-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary btn-sm";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", () => box.remove());

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-primary btn-sm";
    saveBtn.textContent = "Salvar resposta oficial";
    saveBtn.addEventListener("click", async () => {
      const texto = textarea.value.trim();
      if (!texto) {
        errorEl.textContent = "Digite uma resposta antes de salvar.";
        return;
      }
      await saveReply(item.id, texto, getTodayISO());
      window.NovaEraApp?.showToast("Resposta oficial salva localmente!", "success");
      await renderPublicList();
    });

    actions.append(cancelBtn, saveBtn);
    box.append(note, textarea, errorEl, actions);
    card.appendChild(box);
    textarea.focus();
  }

  document.addEventListener("DOMContentLoaded", initPublicComments);
})();