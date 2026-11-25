(function () {
  "use strict";

  const DEFAULT_CONFIG = {
    chapa: {
      nome: "NOVA ERA",
      subtitulo: "Grêmio Estudantil",
      fraseInstitucional:
        "Representatividade, união e protagonismo estudantil para construir uma escola melhor todos os dias.",
      anoReferencia: 2026,
      logoPath: "./assets/logo/logo-placeholder.svg"
    },
    redesSociais: {
      instagram: { usuario: "@gremio.novaera.exemplo", url: "#" },
      facebook: { pagina: "Grêmio Estudantil Nova Era", url: "#" },
      whatsapp: {
        numero: "",
        mensagemInicial: "Olá, equipe Nova Era!"
      }
    },
    comentariosConfig: {
      tamanhoMaximoMensagem: 500
    }
  };

  window.NovaEraApp = {
    config: DEFAULT_CONFIG,

    showToast(message, type = "info") {
      const container = document.getElementById("toast-container");
      if (!container) return;

      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 4200);
    },

    formatDateBR(isoDate) {
      if (!isoDate || typeof isoDate !== "string") return "";
      const parts = isoDate.split("-");
      if (parts.length !== 3) return isoDate;
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
  };

  async function loadConfig() {
    try {
      const response = await fetch("./data/config.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao carregar config.json");
      const data = await response.json();
      window.NovaEraApp.config = { ...DEFAULT_CONFIG, ...data };
      applyConfig(window.NovaEraApp.config);
      document.dispatchEvent(new CustomEvent("novaera:config-loaded", { detail: window.NovaEraApp.config }));
    } catch (error) {
      console.warn("Usando configurações padrão:", error.message);
      applyConfig(DEFAULT_CONFIG);
    }
  }

  function applyConfig(cfg) {
    const chapa = cfg.chapa || DEFAULT_CONFIG.chapa;
    const redes = cfg.redesSociais || DEFAULT_CONFIG.redesSociais;

    const logoEls = [
      document.getElementById("header-logo"),
      document.getElementById("hero-logo"),
      document.getElementById("footer-logo")
    ];
    logoEls.forEach((img) => {
      if (img && chapa.logoPath) {
        img.src = chapa.logoPath;
      }
    });

    const headerName = document.getElementById("header-brand-name");
    const footerName = document.getElementById("footer-brand-name");
    const footerFrase = document.getElementById("footer-frase");
    const heroAno = document.getElementById("hero-ano");
    const footerAno = document.getElementById("footer-ano");

    if (headerName && chapa.nome) headerName.textContent = chapa.nome;
    if (footerName && chapa.nome) footerName.textContent = chapa.nome;
    if (footerFrase && chapa.fraseInstitucional) footerFrase.textContent = chapa.fraseInstitucional;
    if (heroAno && chapa.anoReferencia) heroAno.textContent = chapa.anoReferencia;
    if (footerAno && chapa.anoReferencia) footerAno.textContent = chapa.anoReferencia;

    const igUrl = redes.instagram?.url || "#";
    const fbUrl = redes.facebook?.url || "#";
    const waNumero = (redes.whatsapp?.numero || "").replace(/\D/g, "");
    const waMsg = encodeURIComponent(redes.whatsapp?.mensagemInicial || "Olá, chapa Nova Era!");
    const waUrl = waNumero ? `https://wa.me/${waNumero}?text=${waMsg}` : "#";

    const igCard = document.getElementById("social-instagram");
    const igUser = document.getElementById("social-instagram-user");
    const fbCard = document.getElementById("social-facebook");
    const fbPage = document.getElementById("social-facebook-page");
    const waCard = document.getElementById("social-whatsapp");

    if (igCard) igCard.href = igUrl;
    if (igUser && redes.instagram?.usuario) igUser.textContent = redes.instagram.usuario;
    if (fbCard) fbCard.href = fbUrl;
    if (fbPage && redes.facebook?.pagina) fbPage.textContent = redes.facebook.pagina;
    if (waCard) waCard.href = waUrl;

    const footerIg = document.getElementById("footer-instagram");
    const footerFb = document.getElementById("footer-facebook");
    const footerWa = document.getElementById("footer-whatsapp");
    if (footerIg) footerIg.href = igUrl;
    if (footerFb) footerFb.href = fbUrl;
    if (footerWa) footerWa.href = waUrl;

    [igCard, fbCard, waCard, footerIg, footerFb, footerWa].forEach((linkEl) => {
      if (!linkEl) return;
      linkEl.addEventListener("click", (event) => {
        const href = linkEl.getAttribute("href");
        if (!href || href === "#" || href.includes("SEU_PERFIL") || href.includes("SUA_PAGINA") || href.includes("5500000000000")) {
          event.preventDefault();
          window.NovaEraApp.showToast(
            "Link de exemplo: atualize os endereços oficiais em data/config.json.",
            "info"
          );
        }
      });
    });
  }

  function setupNavigation() {
    const header = document.getElementById("site-header");
    const navToggle = document.getElementById("nav-toggle");
    const mainNav = document.getElementById("main-nav");
    const navLinks = document.querySelectorAll(".nav-link, .nav-cta");

    window.addEventListener("scroll", () => {
      if (header) {
        header.classList.toggle("scrolled", window.scrollY > 12);
      }
    });

    if (navToggle && mainNav) {
      const closeMenu = () => {
        mainNav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Abrir menu de navegação");
      };

      navToggle.addEventListener("click", () => {
        const isOpen = mainNav.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
        navToggle.setAttribute("aria-label", isOpen ? "Fechar menu de navegação" : "Abrir menu de navegação");
      });

      navLinks.forEach((link) => link.addEventListener("click", closeMenu));

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && mainNav.classList.contains("open")) {
          closeMenu();
          navToggle.focus();
        }
      });
    }

    const sections = document.querySelectorAll("main section[id]");
    const menuLinks = document.querySelectorAll(".nav-link");

    if ("IntersectionObserver" in window && sections.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute("id");
              menuLinks.forEach((link) => {
                link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
              });
            }
          });
        },
        { rootMargin: "-40% 0px -50% 0px" }
      );

      sections.forEach((section) => observer.observe(section));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    loadConfig();
  });
})();