(function () {
  "use strict";

  const FALLBACK_IMG = "./assets/projetos/placeholder-projeto.svg";
  let todosProjetos = [];
  let categoriaAtual = "todas";
  let situacaoAtual = "todas";

  async function initProjetos() {
    const grid = document.getElementById("projetos-grid");
    const statusEl = document.getElementById("projetos-status");
    const selectCategoria = document.getElementById("filtro-categoria");
    const pillsSituacao = document.getElementById("projetos-filtros-situacao");

    if (!grid) return;

    try {
      const response = await fetch("./data/projetos.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      todosProjetos = Array.isArray(data.projetos) ? data.projetos : [];

      popularCategorias(selectCategoria, todosProjetos);
      aplicarFiltros(grid);

      if (selectCategoria) {
        selectCategoria.addEventListener("change", (event) => {
          categoriaAtual = event.target.value;
          aplicarFiltros(grid);
        });
      }

      if (pillsSituacao) {
        pillsSituacao.addEventListener("click", (event) => {
          const btn = event.target.closest(".pill-btn");
          if (!btn) return;

          pillsSituacao.querySelectorAll(".pill-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          situacaoAtual = btn.dataset.situacao || "todas";
          aplicarFiltros(grid);
        });
      }
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
      if (statusEl) {
        statusEl.className = "status-message is-error";
        statusEl.textContent =
          "Não foi possível carregar os projetos no momento. Verifique o arquivo data/projetos.json.";
      }
    }
  }

  function popularCategorias(selectEl, projetos) {
    if (!selectEl) return;
    const categorias = [...new Set(projetos.map((p) => p.categoria).filter(Boolean))].sort();
    categorias.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      selectEl.appendChild(option);
    });
  }

  function aplicarFiltros(grid) {
    const filtrados = todosProjetos.filter((proj) => {
      const matchCategoria = categoriaAtual === "todas" || proj.categoria === categoriaAtual;
      const matchSituacao = situacaoAtual === "todas" || proj.situacao === situacaoAtual;
      return matchCategoria && matchSituacao;
    });

    renderProjetos(grid, filtrados);
  }

  function getStatusClass(situacao) {
    const norm = (situacao || "").toLowerCase();
    if (norm === "concluído" || norm === "concluido") return "status-concluido";
    if (norm === "em andamento") return "status-andamento";
    return "status-planejado";
  }

  function renderProjetos(container, projetos) {
    container.innerHTML = "";

    if (projetos.length === 0) {
      container.innerHTML = `<div class="empty-state">Nenhum projeto encontrado para os filtros selecionados.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    projetos.forEach((projeto) => {
      const card = document.createElement("article");
      card.className = "projeto-card";

      const imgWrap = document.createElement("div");
      imgWrap.className = "projeto-img-wrap";

      const img = document.createElement("img");
      img.className = "projeto-img";
      img.src = projeto.imagem || FALLBACK_IMG;
      img.alt = `Ilustração do projeto ${projeto.titulo || ""}`;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        if (!img.dataset.fallbackApplied) {
          img.dataset.fallbackApplied = "true";
          img.src = FALLBACK_IMG;
        }
      });

      imgWrap.appendChild(img);

      const body = document.createElement("div");
      body.className = "projeto-body";

      const meta = document.createElement("div");
      meta.className = "projeto-meta";

      const catBadge = document.createElement("span");
      catBadge.className = "projeto-categoria";
      catBadge.textContent = projeto.categoria || "Geral";

      const statusBadge = document.createElement("span");
      statusBadge.className = `status-badge ${getStatusClass(projeto.situacao)}`;
      statusBadge.textContent = projeto.situacao || "Planejado";

      meta.append(catBadge, statusBadge);

      const titulo = document.createElement("h3");
      titulo.className = "projeto-titulo";
      titulo.textContent = projeto.titulo || "Projeto sem título";

      const desc = document.createElement("p");
      desc.className = "projeto-desc";
      desc.textContent = projeto.descricao || "";

      body.append(meta, titulo, desc);
      card.append(imgWrap, body);
      fragment.appendChild(card);
    });

    container.appendChild(fragment);
  }

  document.addEventListener("DOMContentLoaded", initProjetos);
})();