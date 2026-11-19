(function () {
  "use strict";

  async function initNoticias() {
    const grid = document.getElementById("noticias-grid");
    const statusEl = document.getElementById("noticias-status");
    if (!grid) return;

    try {
      const response = await fetch("./data/noticias.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const noticias = Array.isArray(data.noticias) ? data.noticias : [];

      noticias.sort((a, b) => (b.data || "").localeCompare(a.data || ""));

      renderNoticias(grid, noticias);
      setupModal();
    } catch (error) {
      console.error("Erro ao carregar notícias:", error);
      if (statusEl) {
        statusEl.className = "status-message is-error";
        statusEl.textContent =
          "Não foi possível carregar as notícias no momento. Verifique o arquivo data/noticias.json.";
      }
    }
  }

  function renderNoticias(container, noticias) {
    container.innerHTML = "";

    if (noticias.length === 0) {
      container.innerHTML = `<div class="empty-state">Nenhuma notícia publicada até o momento.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    noticias.forEach((noticia) => {
      const card = document.createElement("article");
      card.className = "noticia-card";

      if (noticia.imagem) {
        const imgWrap = document.createElement("div");
        imgWrap.className = "noticia-img-wrap";

        const img = document.createElement("img");
        img.className = "noticia-img";
        img.src = noticia.imagem;
        img.alt = `Imagem da notícia: ${noticia.titulo || ""}`;
        img.loading = "lazy";
        img.addEventListener("error", () => {
          imgWrap.remove();
        });

        imgWrap.appendChild(img);
        card.appendChild(imgWrap);
      }

      const body = document.createElement("div");
      body.className = "noticia-body";

      const meta = document.createElement("div");
      meta.className = "noticia-meta";

      if (noticia.tipo) {
        const tipo = document.createElement("span");
        tipo.className = "noticia-tipo";
        tipo.textContent = noticia.tipo;
        meta.appendChild(tipo);
      }

      const dataEl = document.createElement("time");
      dataEl.dateTime = noticia.data || "";
      dataEl.textContent = window.NovaEraApp
        ? window.NovaEraApp.formatDateBR(noticia.data)
        : noticia.data || "";
      meta.appendChild(dataEl);

      const titulo = document.createElement("h3");
      titulo.className = "noticia-titulo";
      titulo.textContent = noticia.titulo || "Comunicado";

      const resumo = document.createElement("p");
      resumo.className = "noticia-resumo";
      const textoCompleto = noticia.conteudo || "";
      resumo.textContent =
        textoCompleto.length > 165 ? `${textoCompleto.slice(0, 165).trim()}...` : textoCompleto;

      const btnLer = document.createElement("button");
      btnLer.type = "button";
      btnLer.className = "noticia-ler-btn";
      btnLer.textContent = "Ler comunicado completo \u2192";
      btnLer.addEventListener("click", () => abrirModalNoticia(noticia));

      body.append(meta, titulo, resumo, btnLer);
      card.appendChild(body);
      fragment.appendChild(card);
    });

    container.appendChild(fragment);
  }

  function abrirModalNoticia(noticia) {
    const modal = document.getElementById("noticia-modal");
    const titulo = document.getElementById("noticia-modal-titulo");
    const meta = document.getElementById("noticia-modal-meta");
    const img = document.getElementById("noticia-modal-imagem");
    const conteudo = document.getElementById("noticia-modal-conteudo");

    if (!modal) return;

    const dataFormatada = window.NovaEraApp
      ? window.NovaEraApp.formatDateBR(noticia.data)
      : noticia.data || "";

    meta.textContent = [noticia.tipo, dataFormatada].filter(Boolean).join(" • ");
    titulo.textContent = noticia.titulo || "";
    conteudo.textContent = noticia.conteudo || "";

    if (noticia.imagem) {
      img.src = noticia.imagem;
      img.alt = noticia.titulo || "";
      img.hidden = false;
    } else {
      img.hidden = true;
      img.src = "";
    }

    modal.hidden = false;
    document.getElementById("noticia-modal-fechar")?.focus();
  }

  function setupModal() {
    const modal = document.getElementById("noticia-modal");
    const btnClose = document.getElementById("noticia-modal-fechar");
    if (!modal) return;

    const fechar = () => {
      modal.hidden = true;
    };

    btnClose?.addEventListener("click", fechar);
    modal.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", fechar);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        fechar();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initNoticias);
})();