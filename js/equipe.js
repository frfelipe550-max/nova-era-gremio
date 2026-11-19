(function () {
  "use strict";

  const FALLBACK_FOTO = "./assets/membros/placeholder-membro.svg";

  async function initEquipe() {
    const grid = document.getElementById("equipe-grid");
    const statusEl = document.getElementById("equipe-status");
    if (!grid) return;

    try {
      const response = await fetch("./data/equipe.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const integrantes = Array.isArray(data.integrantes) ? data.integrantes : [];

      if (integrantes.length === 0) {
        grid.innerHTML = `<div class="empty-state">Nenhum integrante cadastrado no arquivo <code>data/equipe.json</code>.</div>`;
        return;
      }

      renderEquipe(grid, integrantes);
    } catch (error) {
      console.error("Erro ao carregar equipe:", error);
      if (statusEl) {
        statusEl.className = "status-message is-error";
        statusEl.textContent =
          "Não foi possível carregar os dados da equipe. Se estiver abrindo o arquivo diretamente (file://), utilize um servidor local ou GitHub Pages.";
      }
    }
  }

  function renderEquipe(container, integrantes) {
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    integrantes.forEach((membro) => {
      const card = document.createElement("article");
      card.className = "membro-card";

      const fotoWrap = document.createElement("div");
      fotoWrap.className = "membro-foto-wrap";

      const img = document.createElement("img");
      img.className = "membro-foto";
      img.src = membro.foto || FALLBACK_FOTO;
      img.alt = `Fotografia de ${membro.nome || "integrante da Nova Era"}`;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        if (!img.dataset.fallbackApplied) {
          img.dataset.fallbackApplied = "true";
          img.src = FALLBACK_FOTO;
        }
      });

      const cargoBadge = document.createElement("span");
      cargoBadge.className = "membro-cargo-badge";
      cargoBadge.textContent = membro.cargo || "Integrante";

      fotoWrap.append(img, cargoBadge);

      const body = document.createElement("div");
      body.className = "membro-body";

      const nome = document.createElement("h3");
      nome.className = "membro-nome";
      nome.textContent = membro.nome || "Nome não informado";

      const turma = document.createElement("p");
      turma.className = "membro-turma";
      turma.textContent = membro.turma || "Turma não informada";

      body.append(nome, turma);

      if (membro.descricao) {
        const desc = document.createElement("p");
        desc.className = "membro-desc";
        desc.textContent = membro.descricao;
        body.appendChild(desc);
      }

      card.append(fotoWrap, body);
      fragment.appendChild(card);
    });

    container.appendChild(fragment);
  }

  document.addEventListener("DOMContentLoaded", initEquipe);
})();