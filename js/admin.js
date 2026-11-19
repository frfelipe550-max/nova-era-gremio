(function () {
  "use strict";

  const service = window.NovaEraComentariosService;
  if (!service) return;

  let adminConfig = null;
  let allComments = [];
  let pendingDeleteId = null;

  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  async function initAdmin() {
    try {
      adminConfig = await service.fetchConfig();
    } catch {
      adminConfig = { administracao: { senhaVisual: "novaera2026" } };
    }

    const expectedPassword = adminConfig?.administracao?.senhaVisual || "novaera2026";
    const loginSection = document.getElementById("admin-login-section");
    const panelSection = document.getElementById("admin-panel-section");
    const logoutBtn = document.getElementById("admin-logout-btn");
    const loginForm = document.getElementById("admin-login-form");
    const passwordInput = document.getElementById("admin-password");
    const loginError = document.getElementById("admin-login-error");

    const openPanel = async () => {
      loginSection.hidden = true;
      panelSection.hidden = false;
      logoutBtn.hidden = false;
      await refreshDashboard();
    };

    if (sessionStorage.getItem(service.AUTH_SESSION_KEY) === "true") {
      await openPanel();
    }

    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      loginError.textContent = "";

      if (passwordInput.value === expectedPassword) {
        sessionStorage.setItem(service.AUTH_SESSION_KEY, "true");
        passwordInput.value = "";
        await openPanel();
      } else {
        loginError.textContent = "Senha incorreta. Confira a configuração em data/config.json.";
        passwordInput.focus();
      }
    });

    logoutBtn?.addEventListener("click", () => {
      sessionStorage.removeItem(service.AUTH_SESSION_KEY);
      panelSection.hidden = true;
      logoutBtn.hidden = true;
      loginSection.hidden = false;
    });

    setupToolbar();
    setupModals();
  }

  async function refreshDashboard() {
    const statusEl = document.getElementById("admin-status");
    const result = await service.getMergedComments();
    allComments = result.comentarios;

    if (result.fetchError && statusEl) {
      statusEl.className = "status-message is-error";
      statusEl.textContent =
        "Não foi possível carregar data/comentarios.json automaticamente. Você ainda pode importar um arquivo comentarios.json manualmente.";
    } else if (statusEl) {
      statusEl.textContent = "";
      statusEl.className = "status-message";
    }

    const total = allComments.length;
    const respondidos = allComments.filter((c) => Boolean(c.resposta && c.resposta.texto)).length;
    const pendentes = total - respondidos;

    document.getElementById("stat-total").textContent = String(total);
    document.getElementById("stat-respondidos").textContent = String(respondidos);
    document.getElementById("stat-pendentes").textContent = String(pendentes);
    document.getElementById("stat-pendentes-sync").textContent = String(result.pendingSyncCount);

    renderFilteredAdminList();
  }

  function renderFilteredAdminList() {
    const listEl = document.getElementById("admin-comentarios-lista");
    const searchVal = (document.getElementById("admin-search")?.value || "").trim().toLowerCase();
    const filterStatus = document.getElementById("admin-filter-status")?.value || "todos";

    const filtered = allComments.filter((item) => {
      const hasReply = Boolean(item.resposta && item.resposta.texto);
      if (filterStatus === "respondidos" && !hasReply) return false;
      if (filterStatus === "pendentes" && hasReply) return false;

      if (!searchVal) return true;
      const haystack = `${item.id} ${item.nome} ${item.turma} ${item.mensagem} ${item.resposta?.texto || ""}`.toLowerCase();
      return haystack.includes(searchVal);
    });

    listEl.innerHTML = "";

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state">Nenhum comentário encontrado com os filtros atuais.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach((item) => {
      const hasReply = Boolean(item.resposta && item.resposta.texto);
      const card = document.createElement("article");
      card.className = "admin-comment-card";

      const top = document.createElement("div");
      top.className = "admin-comment-top";

      const meta = document.createElement("div");
      meta.className = "admin-comment-meta";

      const idTag = document.createElement("span");
      idTag.className = "comment-id-tag";
      idTag.textContent = item.id;

      const nome = document.createElement("strong");
      nome.textContent = item.nome;

      const turma = document.createElement("span");
      turma.className = "comentario-turma";
      turma.textContent = item.turma;

      const statusBadge = document.createElement("span");
      statusBadge.className = `status-badge ${hasReply ? "status-concluido" : "status-andamento"}`;
      statusBadge.textContent = hasReply ? "Respondido" : "Pendente";

      meta.append(idTag, nome, turma, statusBadge);

      if (item._isLocal || item._isLocalModified) {
        const localTag = document.createElement("span");
        localTag.className = "comentario-local-badge";
        localTag.textContent = "Alteração local (exportar JSON)";
        meta.appendChild(localTag);
      }

      const data = document.createElement("span");
      data.className = "comentario-data";
      data.textContent = service.formatDateBR(item.data);

      top.append(meta, data);

      const texto = document.createElement("p");
      texto.className = "comentario-texto";
      texto.textContent = item.mensagem;

      card.append(top, texto);

      if (hasReply) {
        const respBox = document.createElement("div");
        respBox.className = "resposta-oficial";

        const respHeader = document.createElement("div");
        respHeader.className = "resposta-header";

        const respBadge = document.createElement("span");
        respBadge.className = "resposta-badge";
        respBadge.textContent = "Resposta Oficial — Nova Era";

        const respData = document.createElement("span");
        respData.className = "resposta-data";
        respData.textContent = service.formatDateBR(item.resposta.data);

        respHeader.append(respBadge, respData);

        const respTexto = document.createElement("p");
        respTexto.className = "resposta-texto";
        respTexto.textContent = item.resposta.texto;

        respBox.append(respHeader, respTexto);
        card.appendChild(respBox);
      }

      const actions = document.createElement("div");
      actions.className = "admin-comment-actions";

      const btnReply = document.createElement("button");
      btnReply.type = "button";
      btnReply.className = "btn btn-primary btn-sm";
      btnReply.textContent = hasReply ? "Editar resposta" : "Responder";
      btnReply.addEventListener("click", () => openReplyModal(item));

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn btn-secondary btn-sm";
      btnEdit.textContent = "Editar comentário";
      btnEdit.addEventListener("click", () => openEditModal(item));

      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "btn btn-outline-danger btn-sm";
      btnDelete.textContent = "Excluir";
      btnDelete.addEventListener("click", () => openDeleteModal(item));

      actions.append(btnReply, btnEdit, btnDelete);
      card.appendChild(actions);

      fragment.appendChild(card);
    });

    listEl.appendChild(fragment);
  }

  function setupToolbar() {
    document.getElementById("admin-search")?.addEventListener("input", renderFilteredAdminList);
    document.getElementById("admin-filter-status")?.addEventListener("change", renderFilteredAdminList);

    document.getElementById("btn-exportar-json")?.addEventListener("click", async () => {
      const jsonString = await service.buildExportJSONString();
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "comentarios.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      showToast("Arquivo comentarios.json exportado com sucesso!", "success");
    });

    const fileInput = document.getElementById("input-importar-json");
    document.getElementById("btn-importar-json")?.addEventListener("click", () => {
      fileInput?.click();
    });

    fileInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!parsed || !Array.isArray(parsed.comentarios)) {
          throw new Error('Estrutura inválida. O JSON deve conter o array "comentarios".');
        }

        const invalidItem = parsed.comentarios.find(
          (c) => !c || typeof c.nome !== "string" || typeof c.mensagem !== "string"
        );
        if (invalidItem) {
          throw new Error("Um ou mais comentários estão sem nome ou mensagem válidos.");
        }

        await service.importCommentsArray(parsed.comentarios);
        await refreshDashboard();
        showToast(`${parsed.comentarios.length} comentários importados com sucesso!`, "success");
      } catch (err) {
        showToast(`Erro ao importar JSON: ${err.message}`, "error");
      } finally {
        fileInput.value = "";
      }
    });

    document.getElementById("btn-resetar-local")?.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Deseja limpar as alterações temporárias salvas neste navegador e recarregar exatamente o arquivo data/comentarios.json publicado?"
      );
      if (!confirmed) return;
      service.resetLocalChanges();
      await refreshDashboard();
      showToast("Lista sincronizada com data/comentarios.json!", "info");
    });
  }

  function openReplyModal(item) {
    const modal = document.getElementById("admin-reply-modal");
    document.getElementById("reply-id").value = item.id;
    document.getElementById("reply-autor-info").textContent =
      `${item.nome} (${item.turma}) • ${service.formatDateBR(item.data)}`;
    document.getElementById("reply-mensagem-original").textContent = item.mensagem;
    document.getElementById("reply-texto").value = item.resposta?.texto || "";
    document.getElementById("reply-data").value = item.resposta?.data || service.getTodayISO();

    const removeBtn = document.getElementById("admin-reply-remove");
    removeBtn.hidden = !(item.resposta && item.resposta.texto);

    modal.hidden = false;
    document.getElementById("reply-texto").focus();
  }

  function openEditModal(item) {
    const modal = document.getElementById("admin-edit-modal");
    document.getElementById("edit-id").value = item.id;
    document.getElementById("edit-nome").value = item.nome;
    document.getElementById("edit-turma").value = item.turma;
    document.getElementById("edit-data").value = item.data;
    document.getElementById("edit-mensagem").value = item.mensagem;
    modal.hidden = false;
    document.getElementById("edit-nome").focus();
  }

  function openDeleteModal(item) {
    const modal = document.getElementById("admin-delete-modal");
    pendingDeleteId = item.id;
    document.getElementById("delete-preview").textContent = `${item.nome} (${item.turma}): "${item.mensagem}"`;
    modal.hidden = false;
  }

  function setupModals() {
    const replyModal = document.getElementById("admin-reply-modal");
    const editModal = document.getElementById("admin-edit-modal");
    const deleteModal = document.getElementById("admin-delete-modal");

    const closeAll = () => {
      replyModal.hidden = true;
      editModal.hidden = true;
      deleteModal.hidden = true;
      pendingDeleteId = null;
    };

    document.getElementById("admin-reply-close")?.addEventListener("click", closeAll);
    document.getElementById("admin-reply-cancel")?.addEventListener("click", closeAll);
    replyModal?.querySelectorAll("[data-close-reply]").forEach((el) => el.addEventListener("click", closeAll));

    document.getElementById("admin-edit-close")?.addEventListener("click", closeAll);
    document.getElementById("admin-edit-cancel")?.addEventListener("click", closeAll);
    editModal?.querySelectorAll("[data-close-edit]").forEach((el) => el.addEventListener("click", closeAll));

    document.getElementById("admin-delete-close")?.addEventListener("click", closeAll);
    document.getElementById("admin-delete-cancel")?.addEventListener("click", closeAll);
    deleteModal?.querySelectorAll("[data-close-delete]").forEach((el) => el.addEventListener("click", closeAll));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });

    document.getElementById("admin-reply-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("reply-id").value;
      const texto = document.getElementById("reply-texto").value.trim();
      const data = document.getElementById("reply-data").value;
      if (!texto) return;

      await service.saveReply(id, texto, data);
      closeAll();
      await refreshDashboard();
      showToast("Resposta oficial salva!", "success");
    });

    document.getElementById("admin-reply-remove")?.addEventListener("click", async () => {
      const id = document.getElementById("reply-id").value;
      await service.saveReply(id, "", "");
      closeAll();
      await refreshDashboard();
      showToast("Resposta removida.", "info");
    });

    document.getElementById("admin-edit-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("edit-id").value;
      await service.updateComment(id, {
        nome: document.getElementById("edit-nome").value,
        turma: document.getElementById("edit-turma").value,
        data: document.getElementById("edit-data").value,
        mensagem: document.getElementById("edit-mensagem").value
      });
      closeAll();
      await refreshDashboard();
      showToast("Comentário atualizado!", "success");
    });

    document.getElementById("admin-delete-confirm")?.addEventListener("click", async () => {
      if (!pendingDeleteId) return;
      await service.deleteComment(pendingDeleteId);
      closeAll();
      await refreshDashboard();
      showToast("Comentário excluído da lista local.", "info");
    });
  }

  document.addEventListener("DOMContentLoaded", initAdmin);
})();