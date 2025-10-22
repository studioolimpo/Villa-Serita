gsap.registerPlugin(CSSPlugin);

// ===========================================
// BARBA HOOK: leave — calcolo label in anticipo dal link cliccato
// ===========================================
if (window.barba && window.barba.hooks) {
  barba.hooks.leave((data) => {
    const { ns, lang, label, href } = computeNextMetaFromTrigger(data);
    window.__nextLabel = label;
    console.log("🧭 leave → next meta:", { href, ns, lang, label });
  });
}

/***********************
 * GLOBAL LABEL FOR BARBA TRANSITION
 ***********************/
window.__nextLabel = null;


/***********************
 * HELPER FUNZIONI MULTILINGUA
 ***********************/

// Normalizza e mappa pathname -> namespace
function pathToNamespace(pathname) {
  // Rimuove trailing slash e prefisso lingua "/en"
  let p = String(pathname || "").replace(/\/+$/, "").replace(/^\/en(\/|$)/, "/");

  // Home
  if (p === "" || p === "/") return "home";

  // Prende l'ultimo segmento, decodifica ed uniforma
  const last = decodeURIComponent(p.split("/").filter(Boolean).pop() || "").toLowerCase();

  // Mappa slug -> namespace (gestione nomi composti)
  const map = {
    "la-villa": "villa",
    "villa": "villa",
    "halloween-in-villa": "halloween",

    "eventi-privati": "eventi",
    "eventi": "eventi",

    "matrimoni": "matrimoni",
    "ristorante": "ristorante",
    "esperienze": "esperienze",
    "contatti": "contatti",

    "404": "err404",
    "errore": "err404"
  };

  return map[last] || last;
}

function getLangFromUrl(urlLike) {
  const u = new URL(urlLike, window.location.origin);
  return u.pathname.startsWith('/en') ? 'en' : 'it';
}

function computeNextMetaFromTrigger(data) {
  let href = data?.trigger?.getAttribute?.('href') || null;
  if (!href) href = window.location.href;
  const u = new URL(href, window.location.origin);
  const lang = u.pathname.startsWith('/en') ? 'en' : 'it';
  const ns = pathToNamespace(u.pathname);
  const label = getPageLabel(ns, lang);
  return { href: u.href, lang, ns, label };
}




/* ============================================
   🔤 GET PAGE LABEL — con supporto lingua forzata
   ============================================ */
function getPageLabel(namespace, langOverride) {
  const lang = langOverride || getCurrentLang();
  const labels = PAGE_LABELS[namespace];

  if (!labels) {
    console.warn(`⚠️ Nessuna label trovata per namespace: ${namespace}`);
    return namespace;
  }

  // Restituisce la stringa corretta in base alla lingua
  return labels[lang] || labels.it || namespace;
}


/***********************
 * GSAP CUSTOM EASES
 ***********************/
CustomEase.create("loader", "0.65, 0.01, 0.05, 0.99");
CustomEase.create("loaderPanel", "0.75, 0, 0.15, 1");
CustomEase.create("spinStar", "0.7, 0, 0.2, 1");
CustomEase.create("main", "0.33, 0, 0.13, 1");
CustomEase.create("bgPanelEase", "0.86,0,0.07,1");

/***********************
 * MIN CORE: label & transition title
 ***********************/

/* ============================================
   🌍 LINGUA CORRENTE
   Lettura diretta dall'attributo <html lang="">
   ============================================ */
function getCurrentLang() {
  const htmlLang = document.documentElement.getAttribute("lang");
  return htmlLang && htmlLang.toLowerCase().startsWith("en") ? "en" : "it";
}


/**
 * 🔄 Sincronizza gli href di tutti i language switcher presenti nella pagina.
 * Copia i link dal primo switcher (master) a tutti gli altri.
 */
function updateLangSwitcherLinks() {
  const switchers = document.querySelectorAll("[data-lang-switch]");
  if (!switchers.length) return;

  const currentURL = new URL(window.location.href);
  const currentLang = currentURL.pathname.startsWith("/en") ? "en" : "it";

  switchers.forEach((switcher) => {
    const itWrap = switcher.querySelector('[data-lang="it"] a');
    const enWrap = switcher.querySelector('[data-lang="en"] a');

    if (!itWrap || !enWrap) return;

    // 🔹 Normalizza il percorso
    const normalizedPath = currentURL.pathname.replace(/^\/en/, "");

    // 🔹 Costruisci i nuovi URL
    const itURL = normalizedPath === "/" ? "/" : normalizedPath;
    const enURL = normalizedPath === "/" ? "/en" : `/en${normalizedPath}`;

    // 🔹 Assegna href dinamici
    itWrap.setAttribute("href", itURL);
    enWrap.setAttribute("href", enURL);

    // 🔹 Gestisci classe attiva visivamente
    if (currentLang === "it") {
      itWrap.closest("[data-lang]").classList.add("is--active");
      enWrap.closest("[data-lang]").classList.remove("is--active");
    } else {
      enWrap.closest("[data-lang]").classList.add("is--active");
      itWrap.closest("[data-lang]").classList.remove("is--active");
    }
  });
}

/**
 * 🔄 Sincronizza e inizializza tutti i language switcher Webflow presenti nella pagina.
 * Funziona con più .w-locales-list (navbar, footer, overlay, ecc.)
 */
function initLanguageSwitcher() {
  document.querySelectorAll("[data-lang-switch] [data-lang]").forEach((link) => {
    link.removeEventListener("click", handleLangSwitch);
    link.addEventListener("click", handleLangSwitch);
  });
}

function handleLangSwitch(e) {
  e.preventDefault();

  const link = e.currentTarget;
  const targetLang = link.dataset.lang?.toLowerCase();
  const currentLang = document.documentElement.getAttribute("lang")?.toLowerCase() || "it";
  const currentPath = window.location.pathname;

  // 🔸 Se clicchi la lingua già attiva → non fare nulla
  if (targetLang === currentLang) {
    console.log("⚠️ Lingua già attiva:", currentLang);
    return;
  }

  let nextPath = currentPath;

  // 🔹 Se passo da IT → EN, aggiungo prefisso /en/
  if (currentLang === "it" && targetLang === "en") {
    nextPath = currentPath.startsWith("/en/")
      ? currentPath
      : `/en${currentPath}`;
  }

  // 🔹 Se passo da EN → IT, rimuovo prefisso /en/
  if (currentLang === "en" && targetLang === "it") {
    nextPath = currentPath.replace(/^\/en/, "") || "/";
  }

  const nextURL = `${window.location.origin}${nextPath}`;
  console.log(`🌐 Cambio lingua da ${currentLang} → ${targetLang} | URL: ${nextURL}`);

  // Disattivo Barba e ricarico
  if (window.barba) barba.destroy();
  window.location.href = nextURL;
}


/* ============================================
   🌐 REGISTRO BILINGUE: LABEL PER NAMESPACE
   Ogni namespace ha due valori: it / en
   ============================================ */
const PAGE_LABELS = {
  home: { it: "Home", en: "Home" },
  villa: { it: "La Villa", en: "The Villa" },
  halloween: { it: "Halloween in Villa", en: "Halloween at The Villa" },
  matrimoni: { it: "Matrimoni", en: "Weddings" },
  eventi: { it: "Eventi Privati", en: "Private Events" },
  ristorante: { it: "Ristorante", en: "Restaurant" },
  esperienze: { it: "Esperienze", en: "Experiences" },
  contatti: { it: "Contattaci", en: "Contact us" },
  err404: { it: "Pagina non trovata", en: "Page Not Found" }
};


/* ============================================
   🔤 GET PAGE LABEL
   Ritorna la label corretta in base alla lingua
   ============================================ */
// (Mantieni solo la versione principale, rimuovi il duplicato)

/* ============================================
   🧩 UTILITY — Ricava il namespace da un container
   ============================================ */
function getNamespace(page) {
  if (!page) return null;

  // 1️⃣ Se esiste il container già montato, leggi direttamente dal dataset
  if (page.container && page.container.dataset && page.container.dataset.barbaNamespace) {
    return page.container.dataset.barbaNamespace;
  }

  // 2️⃣ Se siamo in transizione (fase leave) e il container non è ancora nel DOM,
  //    effettua il parse dell'HTML della prossima pagina per ricavare il namespace.
  if (page.html) {
    try {
      const doc = new DOMParser().parseFromString(page.html, "text/html");
      const ns = doc.querySelector("[data-barba-namespace]")?.getAttribute("data-barba-namespace");
      if (ns) return ns;
    } catch (err) {
      console.warn("⚠️ getNamespace parse fallito:", err);
    }
  }

  return null;
}

/* ============================================
   🔁 GET NEXT LABEL (per pannello transizione)
   Usa il namespace della prossima pagina Barba
   ============================================ */
function getNextLabel(data) {
  // Usa la variabile globale impostata dal hook beforeEnter,
  // fallback a "Home" se non presente
  const label = window.__nextLabel || "Home";
  return label;
}

// general refresh scroll trigger
function refreshScrollTrigger(delay = 0.2) {
  gsap.delayedCall(delay, () => {
    ScrollTrigger.refresh();
    console.log("✅ ScrollTrigger refreshed after hero animation");
  });
}



/***********************
 * Forza scroll in cima alla nuova pagina
 ***********************/
// --- Force next swapped page starts at top during SPA transitions
function forceNextPageToTop() {
  // disattiva qualsiasi restore automatico
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch {}

  const reset = () => {
    try { window.lenis?.scrollTo?.(0, { immediate: true }); } catch {}
    try { window.scrollTo(0, 0); } catch {}
    try { document.documentElement.scrollTop = 0; } catch {}
    try { document.body.scrollTop = 0; } catch {}
  };

  // doppio pass per essere a prova di layout async
  reset();
  requestAnimationFrame(reset);
  setTimeout(reset, 0);
}

/**
 * HARD LOAD TOP — forza lo scroll in cima anche su refresh e BFCache
 * Esegue più pass per battere il restore del browser e quello del BFCache.
 */
function ensureTopOnHardLoad() {
  // Disabilita il ripristino automatico dello scroll del browser
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch {}

  const reset = () => {
    try { window.lenis?.stop(); } catch {}
    try { window.lenis?.scrollTo?.(0, { immediate: true }); } catch {}
    try { window.scrollTo(0, 0); } catch {}
    try { document.documentElement.scrollTop = 0; } catch {}
    try { document.body.scrollTop = 0; } catch {}
  };

  // Esegui subito e in più momenti del ciclo di vita
  reset();
  requestAnimationFrame(reset);
  setTimeout(reset, 0);

  // Quando la pagina è completamente caricata
  window.addEventListener("load", () => {
    reset();
    // Un altro pass appena dopo il paint
    requestAnimationFrame(reset);
  }, { once: true });

  // Quando si rientra dal Back/Forward Cache (Safari/Firefox)
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      reset();
      requestAnimationFrame(reset);
    }
  });

  // Prima di abbandonare la pagina, ribadisce la volontà di non ripristinare
  window.addEventListener("beforeunload", () => {
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch {}
    try { window.scrollTo(0, 0); } catch {}
  });
}


/**
 * AUTOPLAY VIDEO
 * Blocco funzioni che assicurano autoplay video
 */

function ensureVideoAutoplay(video) {
  if (!video) return;

  // Imposta i flag in modo robusto (iOS/Safari richiedono muted + playsInline)
  video.muted = true;
  video.playsInline = true; // property
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('loop', '');

  // Alcuni browser “perdono” il preload dopo il replace del DOM
  if (!video.getAttribute('preload')) video.setAttribute('preload', 'auto');

  // Se la readyState è bassa, chiedi di caricare
  try {
    if (video.readyState < 2) {
      // Forza un (ri)load per far ripartire la pipeline
      // (evita se stai usando <source> multipli con HLS: in quel caso spesso non serve)
      video.load();
    }
  } catch {}

  // Prova a far partire
  const tryPlay = () => {
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Se fallisce (policy browser), riprova quando entra in viewport
        // o al primo interazione utente
      });
    }
  };

  // iOS a volte non parte finché il video non è "visibile"
  // Usiamo un piccolo IntersectionObserver per sicurezza
  if (!video.__ioAttached) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          tryPlay();
        }
      });
    }, { threshold: 0.1 });
    io.observe(video);
    video.__ioAttached = io;
  }

  tryPlay();
}

function initAutoPlayVideos(scope = document) {
  const root = scope instanceof Element ? scope : document;
  const videos = root.querySelectorAll('video[autoplay], video[data-autoplay]');
  videos.forEach(ensureVideoAutoplay);

  // Cleanup handle sul container per eventuale disconnessione degli IO
  root.__videoCleanup = () => {
    videos.forEach(v => {
      try { v.__ioAttached?.disconnect(); } catch {}
      v.__ioAttached = null;
    });
  };
}

function pauseAndResetVideos(scope = document) {
  const root = scope instanceof Element ? scope : document;
  const videos = root.querySelectorAll('video');
  videos.forEach((v) => {
    try {
      v.pause();
      // opzionale: torna a inizio per non “suonare” quando rientri da bfcache
      v.currentTime = 0;
    } catch {}
  });
  // pulizia IO se c'è
  if (typeof root.__videoCleanup === 'function') {
    try { root.__videoCleanup(); } catch {}
    delete root.__videoCleanup;
  }
}






/***********************
 * MENU HANDLER
 ***********************/
function initMenu() {
  gsap.defaults({ ease: "main", duration: 0.7 });

  const navWrap = document.querySelector(".nav_menu_wrap");
  const nav = document.querySelector(".nav_component");
  if (!navWrap || !nav) return;

  let savedTheme = null;

  // Funzione helper per cambiare tema, evitando conflitti di tween sul nav
  const setTheme = (theme, animate = true, delay = 0) => {
    if (!window.colorThemes) return;
    const vars = colorThemes.getTheme(theme);
    if (!vars) return;
    gsap.killTweensOf(nav);
    const action = animate ? gsap.to : gsap.set;
    action(nav, { ...vars, duration: 0.5, ease: "power2.inOut", delay, overwrite: "auto" });
    nav.setAttribute("data-theme", theme);
  };

  const handleMenuTheme = (isOpen) => {
    const currentTheme = nav.getAttribute("data-theme") || "dark";

    if (isOpen) {
      // Salva il tema corrente e forza la navbar su light
      savedTheme = currentTheme;
      if (currentTheme !== "light") {
        setTheme("light", true);
        console.log("🌞 Menu aperto → Navbar light");
      }
    } else {
      // Ripristina il tema salvato
      if (savedTheme) {
        setTheme(savedTheme, true, 0.3);
        console.log(`🌙 Menu chiuso → ripristino tema "${savedTheme}"`);
        savedTheme = null;
      }
    }
  };

  let state = navWrap.getAttribute("data-nav");
  const overlay = navWrap.querySelector(".nav_menu_overlay");
  const menu = navWrap.querySelector(".nav_menu_wrapper");
  const menuLayout = navWrap.querySelector(".nav_menu_layout");
  const bgPanels = navWrap.querySelectorAll(".nav_menu_panel");
  const menuToggles = document.querySelectorAll("[data-menu-toggle]");
  const menuLinks = navWrap.querySelectorAll(".nav_menu_link");
  const menuLanguage = navWrap.querySelector(".lang_switcher");
  const menuButton = document.querySelector(".menu_button_wrap");
  const menuButtonLayout = menuButton.querySelectorAll(".menu_button_layout");
  const menuInfo = navWrap.querySelector(".nav_menu_content");
  const navTransition = navWrap.querySelector(".nav_menu_transition");
  const navMobile = document.querySelector(".nav_mobile_wrap");
  const tl = gsap.timeline();

  const disableNavbarScrollTriggers = () => {
    ScrollTrigger.getAll().forEach(st => {
      if (st.vars.id === "navbar-theme") st.disable();
    });
  };

  const enableNavbarScrollTriggers = () => {
    ScrollTrigger.getAll().forEach(st => {
      if (st.vars.id === "navbar-theme") st.enable();
    });
  };

  const openNav = () => {
    try { lenis.stop(); } catch {}
    navWrap.setAttribute("data-nav", "open");
    tl.clear();
    // Debug group
    console.groupCollapsed("[MENU]", (isOpen => isOpen ? "OPEN" : "CLOSE")(navWrap.getAttribute("data-nav") === "open"));
    console.debug("savedTheme:", savedTheme, "data-theme now:", nav.getAttribute("data-theme"));
    console.groupEnd();
    handleMenuTheme(true);
    disableNavbarScrollTriggers();

    // 🔹 Disattiva temporaneamente tutti gli ScrollTrigger per evitare sfasamenti
    const allTriggers = ScrollTrigger.getAll();
    allTriggers.forEach(t => t.disable(false));

    tl
      .set(navWrap, { display: "block" })
      .set(menuLanguage, { autoAlpha: 0, yPercent: 5 })
      .set(menuInfo, { autoAlpha: 0, yPercent: 5 })
      .set(menu, { yPercent: 0 })
      .set(menuLayout, { opacity: 1 })
      .set(navTransition, { autoAlpha: 0 })
      .fromTo(menuButtonLayout, { yPercent: 0 }, { yPercent: -120, duration: 0.7, ease: "power3.out" }, "<")
      .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, "<")
      .fromTo(bgPanels, { yPercent: -101 }, { yPercent: 0, duration: 1.2, ease: "bgPanelEase" }, "<");

    // Mantieni animazione originale del container principale
    const main = document.querySelector('[data-barba="container"]');
    tl.fromTo(main, { yPercent: 0 }, { yPercent: 2, duration: 1.2, ease: "bgPanelEase" }, "<")
      .fromTo(menuLanguage, { yPercent: 20, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1 }, "<0.3")
      .fromTo(menuLinks, { autoAlpha: 0, yPercent: 5 }, { autoAlpha: 1, yPercent: 0, duration: 1.2, stagger: 0.09 }, "<0.1")
      .fromTo(menuInfo, { yPercent: 5, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1 }, "<0.4")
      // 🔹 Riattiva i trigger e riallinea i marker dopo l'apertura del menu
      .call(() => {
        const allTriggers = ScrollTrigger.getAll();
        allTriggers.forEach(t => t.enable(false));
        ScrollTrigger.refresh(true);
        console.log("🔁 ScrollTrigger refresh after menu open");
      });
  }

  const closeNav = () => {
    navWrap.setAttribute("data-nav", "closed");
    tl.clear();
    // Debug group
    console.groupCollapsed("[MENU]", (isOpen => isOpen ? "OPEN" : "CLOSE")(navWrap.getAttribute("data-nav") === "open"));
    console.debug("savedTheme:", savedTheme, "data-theme now:", nav.getAttribute("data-theme"));
    console.groupEnd();
    handleMenuTheme(false);
    enableNavbarScrollTriggers();

    const main = document.querySelector('[data-barba="container"]');
    tl.to(overlay, { autoAlpha: 0 })
      .to(menuLayout, { opacity: 0, yPercent: 5, duration: 1, ease: "power2.out" }, 0)
      .to(main, { yPercent: 0, duration: 1.2, ease: "bgPanelEase" }, "<")
      .to(menu, { yPercent: -110, duration: 1, ease: "bgPanelEase" }, "<")
      .to(menuButtonLayout, { yPercent: 0 }, "<")
      .set(navWrap, { display: "none" })
      .call(() => {
        try { lenis.start(); } catch {}
      });

    // 🔄 Refresh ScrollTrigger dopo la chiusura del menu per riallineare i marker
    gsap.delayedCall(0.8, () => {
      try {
        if (window.lenis) window.lenis.raf(performance.now());
        ScrollTrigger.refresh(true);
        console.log("✅ ScrollTrigger refresh after menu close");
      } catch (err) {
        console.warn("⚠️ Refresh fallito:", err);
      }
    });
    // navMobile?.classList.remove("u-theme-light");
  };

  const transitionNav = () => {
    navWrap.setAttribute("data-nav", "closed");
    tl.clear()
      .to(overlay, { autoAlpha: 0, delay: 0.1 })
      .to(menu, { yPercent: -110, duration: 1.2, ease: "power2.in" }, "<0.2")
      .to(menuButtonLayout, { yPercent: 0, duration: 1, ease: "bgPanelEase" }, "<0.2")
      .set(navWrap, { display: "none" });
    const main = document.querySelector('[data-barba="container"]');
    tl.to(main, { y: 0, duration: 0.6 }, "<");
    window.__navJustClosed__ = true;
  };

  menuToggles.forEach(toggle => {
    toggle.addEventListener("click", () => {
      const isOpen = navWrap.getAttribute("data-nav") === "open";
      if (isOpen) closeNav();
      else openNav();
    });
  });

  $("a").on("click", function (e) {
    // 🔹 Se il link appartiene al language switcher, non chiudere il menu
    if ($(this).closest("[data-lang-switch]").length > 0) {
      console.log("🌐 Click su language switcher — menu resta aperto");
      return;
    }
    const href = $(this).attr("href");
    const isSameHost = $(this).prop("hostname") === window.location.host;
    const isNotHash = href.indexOf("#") === -1;
    const isNotBlank = $(this).attr("target") !== "_blank";
    const isNavOpen = navWrap.getAttribute("data-nav") === "open";
    const isLangSwitcher = $(this).closest(".footer_switcher_wrapper").length > 0;

    const currentPath = window.location.pathname.replace(/\/$/, "");
    const targetPath = new URL(href, window.location.origin).pathname.replace(/\/$/, "");

    if (isSameHost && isNotHash && isNotBlank && isNavOpen && !isLangSwitcher) {
      e.preventDefault();
      if (currentPath === targetPath) {
        closeNav();
      } else {
        transitionNav();
      }
    }
  });
}





/***********************
 * LENIS: init/destroy + hookup GSAP/ScrollTrigger
 ***********************/
let lenis = null;
let _lenisRaf = null;

function destroyLenis() {
  if (!lenis) return;
  try { lenis.off('scroll', ScrollTrigger.update); } catch {}
  if (_lenisRaf) {
    gsap.ticker.remove(_lenisRaf);
    _lenisRaf = null;
  }
  try { lenis.destroy(); } catch {}
  lenis = null;
  window.lenis = null;
}

function initLenis() {
  if (lenis) return;

  lenis = new Lenis({
    duration: 1.25,
    easing: (e) => Math.min(1, 1.001 - Math.pow(2, -10 * e)),
    smoothWheel: true,
    smoothTouch: false
  });

  window.lenis = lenis;

  lenis.on('scroll', ScrollTrigger.update);

  _lenisRaf = (t) => lenis.raf(t * 1000);
  gsap.ticker.add(_lenisRaf);
  gsap.ticker.lagSmoothing(0);

  if (!window.__lenisControlsBound) {
    $("[data-lenis-start]").on("click", function () { window.lenis?.start(); });
    $("[data-lenis-stop]").on("click", function () { window.lenis?.stop(); });
    $("[data-lenis-toggle]").on("click", function () {
      $(this).toggleClass("stop-scroll");
      $(this).hasClass("stop-scroll") ? window.lenis?.stop() : window.lenis?.start();
    });
    window.__lenisControlsBound = true;
  }
}

/***********************
 * PARALLAX GLOBALE — SCOPE-AWARE
 ***********************/
function initGlobalParallax(scope = document) {

  const mm = gsap.matchMedia();
  const cleanupList = [];
  const queries = {
    isMobile: "(max-width:479px)",
    isMobileLandscape: "(max-width:767px)",
    isTablet: "(max-width:991px)",
    isDesktop: "(min-width:992px)"
  };

  mm.add(queries, (mqCtx) => {
    const { isMobile, isMobileLandscape, isTablet } = mqCtx.conditions;

    const ctx = gsap.context(() => {
      scope.querySelectorAll('[data-parallax="trigger"]').forEach((trigger) => {
        const disable = trigger.getAttribute("data-parallax-disable");
        if (
          (disable === "mobile" && isMobile) ||
          (disable === "mobileLandscape" && isMobileLandscape) ||
          (disable === "tablet" && isTablet)
        ) {
          return;
        }

        const target = trigger.querySelector('[data-parallax="target"]') || trigger;

        const direction = trigger.getAttribute("data-parallax-direction") || "vertical";
        const prop = direction === "horizontal" ? "xPercent" : "yPercent";

        const scrubAttr = trigger.getAttribute("data-parallax-scrub");
        let scrub = true;
        if (scrubAttr != null) {
          const n = parseFloat(scrubAttr);
          scrub = Number.isNaN(n) ? (scrubAttr === "true") : n;
        }

        const startAttr = parseFloat(trigger.getAttribute("data-parallax-start"));
        const endAttr = parseFloat(trigger.getAttribute("data-parallax-end"));
        const startVal = Number.isNaN(startAttr) ? 20 : startAttr;
        const endVal = Number.isNaN(endAttr) ? -20 : endAttr;

        const scrollStartRaw = trigger.getAttribute("data-parallax-scroll-start") || "top bottom";
        const scrollEndRaw = trigger.getAttribute("data-parallax-scroll-end") || "bottom top";
        const scrollStart = `clamp(${scrollStartRaw})`;
        const scrollEnd = `clamp(${scrollEndRaw})`;

        gsap.fromTo(
          target,
          { [prop]: startVal },
          {
            [prop]: endVal,
            ease: "none",
            scrollTrigger: {
              trigger,
              start: scrollStart,
              end: scrollEnd,
              scrub,
            },
          }
        );
      });
    }, scope);

    cleanupList.push(() => ctx.revert());
    return () => ctx.revert();
  });

  scope.__parallaxCleanup = () => {
    try { mm.revert(); } catch {}
    cleanupList.forEach(fn => { try { fn(); } catch {} });
  };
}

/***********************
 * SECTION SCROLL REVEAL
 * Seleziona gli elementi con data-reveal="scroll"
 ***********************/
function initSectionReveal(scope = document) {
  const els = scope.querySelectorAll('[data-reveal="scroll"]');
  if (!els.length) return;

  // Evita duplicati
  const setEls = new Set(els);
  ScrollTrigger.getAll().forEach(t => {
    if (setEls.has(t.trigger)) t.kill();
  });

  els.forEach(el => {
    gsap.set(el, { autoAlpha: 0, yPercent: 10 });

    gsap.to(el, {
      autoAlpha: 1,
      yPercent: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        // markers: true,
        start: "top bottom",
        end: "top 85%",
        toggleActions: "none play none reset",
        invalidateOnRefresh: true
      }
    });
  });
}


/***********************
 * ANIMATE THEME ON SCROLL
 * Seleziona gli elementi con data-reveal="scroll"
 ***********************/
// function initAnimateThemeScroll(scope = document) {
//   const root = scope instanceof Element ? scope : document;

//   root.querySelectorAll("[data-animate-theme-to]").forEach((el) => {
//     const theme = el.getAttribute("data-animate-theme-to");
//     const brand = el.getAttribute("data-animate-brand-to");

//     ScrollTrigger.create({
//       trigger: el,
//       start: "top center",
//       end:   "bottom center",
//       onToggle: ({ isActive }) => {
//         if (isActive && window.colorThemes && typeof window.colorThemes.getTheme === "function") {
//           gsap.to("body", { ...colorThemes.getTheme(theme, brand) });
//         }
//       }
//     });
//   });
// }

/***********************
 * THEME RESET → LIGHT
 ***********************/
// function resetThemeToLight(opts = {}) {
//   const {
//     brand = "default",
//     duration = 0.6,
//     ease = "power2.out"
//   } = opts;

//   // se non c’è colorThemes o getTheme, esco silenziosamente
//   if (!window.colorThemes || typeof window.colorThemes.getTheme !== "function") return;

//   const vars = window.colorThemes.getTheme("light", brand);
//   if (!vars || typeof vars !== "object") return;

//   gsap.to("body", { ...vars, duration, ease, overwrite: "auto" });
// }



/***********************
 * NAVBAR THEME HANDLER
 * Gestisce il cambio tema della navbar (dark → light) in base al namespace
 ***********************/
// =====================================================
// NAVBAR THEME HANDLER — based on Lumos Theme Collector
// =====================================================

/**
 * Ritorna il tema di partenza per il namespace
 */
function getStartThemeForNs(namespace = "home") {
  const navbarConfig = {
    home: { startTheme: "dark" },
    villa: { startTheme: "dark" },
    matrimoni: { startTheme: "dark" },
    eventi: { startTheme: "dark" },
    ristorante: { startTheme: "dark" },
    esperienze: { startTheme: "dark" },
    esperienza: { startTheme: "light" },
    contatti: { startTheme: "light" },
    err404: { startTheme: "light" },
  };
  return (navbarConfig[namespace]?.startTheme) || "dark";
}

// Applica il tema iniziale della navbar senza animazioni, in modo soft (senza killTweens)
function applyNavbarStartTheme(namespace = "home") {
  const nav = document.querySelector(".nav_component");
  if (!nav || !window.colorThemes || !window.colorThemes.getTheme) return;

  const startTheme = getStartThemeForNs(namespace);
  const vars = colorThemes.getTheme(startTheme);

  // 🔹 Applica il tema iniziale senza animazioni
  gsap.set(nav, vars);
  nav.setAttribute("data-theme", startTheme);

  // 🔹 Gestisce anche la background
  gsap.set(".nav_background", {
    autoAlpha: startTheme === "light" ? 1 : 0,
  });

  console.log(`🌙 Navbar soft-set al tema iniziale "${startTheme}"`);
}

/**
 * Forza IMMEDIATAMENTE il tema navbar senza animazioni, uccidendo tweens
 * e impostando lo stato della background per prevenire flash.
 */
function forceNavbarThemeImmediate(theme = "dark") {
  const nav = document.querySelector(".nav_component");
  if (!nav) return;

  // evita transizioni residue
  gsap.killTweensOf(nav);
  gsap.killTweensOf(".nav_background");

  try {
    if (window.colorThemes && typeof window.colorThemes.getTheme === "function") {
      const vars = colorThemes.getTheme(theme);
      if (vars && typeof vars === "object") {
        gsap.set(nav, { ...vars, overwrite: "auto" });
      }
    }
  } catch {}

  nav.setAttribute("data-theme", theme);

  // background nav in sync con il tema
  gsap.set(".nav_background", {
    autoAlpha: theme === "light" ? 1 : 0,
    overwrite: "auto"
  });
}

function setNavbarThemeInitial(namespace = "home") {
  const navbarConfig = {
    home: { startTheme: "dark" },
    villa: { startTheme: "dark" },
    matrimoni: { startTheme: "dark" },
    eventi: { startTheme: "dark" },
    ristorante: { startTheme: "dark" },
    esperienze: { startTheme: "dark" },
    esperienza: { startTheme: "light" },
    contatti: { startTheme: "light" },
    err404: { startTheme: "light" },
  };

  const { startTheme = "dark" } = navbarConfig[namespace] || {};
  const nav = document.querySelector(".nav_component");
  if (!nav) return;

  try {
    const vars = colorThemes.getTheme(startTheme);
    if (vars && typeof vars === "object") gsap.set(nav, { ...vars });
    nav.setAttribute("data-theme", startTheme);
  } catch (e) {
    console.warn("Navbar initial theme error:", e);
  }
}

function initNavbarThemeScroll(namespace = "home") {
  const navbarConfig = {
    home: { startTheme: "dark", trigger: "#section-hero" },
    villa: { startTheme: "dark", trigger: "#section-hero" },
    matrimoni: { startTheme: "dark", trigger: "#section-hero" },
    eventi: { startTheme: "dark", trigger: "#section-hero" },
    ristorante: { startTheme: "dark", trigger: "#section-hero" },
    esperienze: { startTheme: "dark", trigger: "#section-hero" },
    esperienza: { startTheme: "light" },
    contatti: { startTheme: "light" },
  };

  // pulizia vecchi trigger
  try {
    ScrollTrigger.getAll().forEach(st => {
      if (st.vars.id === "navbar-theme") st.kill();
    });
  } catch (err) {
    console.warn("Errore pulizia ScrollTrigger:", err);
  }

  const { startTheme = "dark", trigger = "#section-hero" } = navbarConfig[namespace] || {};
  if (startTheme === "light") return;

  const nav = document.querySelector(".nav_component");
  const triggerEl = document.querySelector(trigger);
  if (!nav || !triggerEl) return;

  ScrollTrigger.create({
    id: "navbar-theme",
    trigger: triggerEl,
    start: "bottom top",
    end: "bottom top",
    // markers: { startColor: "orange", endColor: "orange", fontSize: "10px" },
    onEnter: () => {
      gsap.to(nav, { ...colorThemes.getTheme("light"), ease: "power2.inOut", duration: 0.3 });
      nav.setAttribute("data-theme", "light");


      // 🔹 Fade-in background nav
      gsap.to(".nav_background", {
        autoAlpha: 1,
        duration: 0.3,
        ease: "power2.inOut",
        overwrite: "auto"
      });

    },
    onLeaveBack: () => {
      gsap.to(nav, { ...colorThemes.getTheme(startTheme), ease: "power2.inOut", duration: 0.3 });
      nav.setAttribute("data-theme", startTheme);


      // 🔹 Fade-out background nav
      gsap.to(".nav_background", {
        autoAlpha: 0,
        duration: 0.3,
        ease: "power2.inOut",
        overwrite: "auto"
      });

    },
  });
}



/***********************
 * HIDE / SHOW NAVBAR ON SCROLL
 ***********************/
function initHideNavbarOnScroll(threshold = 80) {
  const nav = document.querySelector(".nav_desktop_wrap");
  if (!nav) return;

  let lastScroll = 0;
  let ticking = false;
  let isHidden = false;


  // ✅ Timeline iniziale per forzare la navbar visibile
  const tlInit = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
  tlInit.set(nav, { yPercent: -100, autoAlpha: 0 }); // assicura posizione iniziale coerente
  tlInit.to(nav, { yPercent: 0, autoAlpha: 1 });     // transizione dolce in ingresso
  isHidden = false;

  // Mostra la navbar
  const showNav = () => {
    if (isHidden) {
      gsap.to(nav, {
        yPercent: 0,
        autoAlpha: 1,
        duration: 0.7,
        ease: "power3.out",
        overwrite: "auto"
      });
      isHidden = false;
    }
  };

  // Nascondi la navbar
  const hideNav = () => {
    if (!isHidden) {
      gsap.to(nav, {
        yPercent: -100,
        autoAlpha: 0.8,
        duration: 0.7,
        ease: "power3.out",
        overwrite: "auto"
      });
      isHidden = true;
    }
  };

  const handleScroll = (scrollY) => {
    const diff = scrollY - lastScroll;

    // Scroll verso il basso oltre la soglia → nascondi
    if (diff > threshold) {
      hideNav();
      lastScroll = scrollY;
    }
    // Scroll verso l’alto oltre la soglia → mostra
    else if (diff < -threshold) {
      showNav();
      lastScroll = scrollY;
    }

    ticking = false;
  };

  const onScroll = (scrollY) => {
    if (!ticking) {
      window.requestAnimationFrame(() => handleScroll(scrollY));
      ticking = true;
    }
  };

  // Hook per Lenis o scroll normale
  if (window.lenis) {
    window.lenis.on("scroll", ({ scroll }) => onScroll(scroll));
  } else {
    window.addEventListener("scroll", () => onScroll(window.scrollY || document.documentElement.scrollTop));
  }

  // Mostra inizialmente
  showNav();
}


/***********************
 * SLIDER GLOBALE
 ***********************/
function initGlobalSlider(scope = document) {
  const components = scope.querySelectorAll("[data-slider='component']:not([data-slider='component'] [data-slider='component'])");
  if (!components.length) return;

  components.forEach((component) => {
    if (component.dataset.scriptInitialized === "true") return;
    component.dataset.scriptInitialized = "true";

    const swiperElement = component.querySelector(".slider_element");
    const swiperWrapper = component.querySelector(".slider_list");
    if (!swiperElement || !swiperWrapper) return;

    // Funzione aggiornata per rimuovere la struttura CMS e mantenere solo gli elementi interni
    function removeCMSList(slot) {
      const dynList = Array.from(slot.children).find((child) => child.classList.contains("w-dyn-list"));
      if (!dynList) return;
      const nestedItems = dynList?.firstElementChild?.children;
      if (!nestedItems) return;
      const staticWrapper = [...slot.children];
      [...nestedItems].forEach(el => el.firstElementChild && slot.appendChild(el.firstElementChild));
      staticWrapper.forEach((el) => el.remove());
    }
    removeCMSList(swiperWrapper);

    [...swiperWrapper.children].forEach((el) => el.classList.add("swiper-slide"));

    const followFinger = swiperElement.getAttribute("data-follow-finger") === "true",
      freeMode = swiperElement.getAttribute("data-free-mode") === "true",
      mousewheel = swiperElement.getAttribute("data-mousewheel") === "true",
      slideToClickedSlide = swiperElement.getAttribute("data-slide-to-clicked") === "true",
      speed = +swiperElement.getAttribute("data-speed") || 600;

    const swiper = new Swiper(swiperElement, {
      slidesPerView: "auto",
      followFinger: followFinger,
      loop: true,
      loopAdditionalSlides: 10,
      freeMode: freeMode,
      slideToClickedSlide: slideToClickedSlide,
      centeredSlides: false,
      autoHeight: false,
      speed: speed,
      mousewheel: {
        enabled: mousewheel,
        forceToAxis: true,
      },
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      navigation: {
        nextEl: component.querySelector("[data-slider='next'] button"),
        prevEl: component.querySelector("[data-slider='previous'] button"),
      },
      pagination: {
        el: component.querySelector(".slider_bullet_list"),
        bulletActiveClass: "is-active",
        bulletClass: "slider_bullet_item",
        bulletElement: "button",
        clickable: true,
      },
      slideActiveClass: "is-active",
      slideDuplicateActiveClass: "is-active",
    });

    component.__swiper = swiper;
  });

  // Cleanup per rimuovere istanze al cambio pagina
  scope.__swiperCleanup = () => {
    components.forEach((component) => {
      try { component.__swiper?.destroy(true, true); } catch {}
      delete component.__swiper;
      delete component.dataset.scriptInitialized;
    });
  };
}

/***********************
 * SLIDER REVIEW (solo namespace "matrimoni")
 ***********************/
function initSliderReview(scope = document) {
  const components = scope.querySelectorAll(".review-slider_component");
  if (!components.length) return;

  components.forEach((component) => {
    if (component.dataset.scriptInitialized === "true") return;
    component.dataset.scriptInitialized = "true";

    const cmsWrap = component.querySelector(".swiper");
    if (!cmsWrap) return;

    const followFinger = cmsWrap.getAttribute("data-follow-finger") === "true";
    const freeMode = cmsWrap.getAttribute("data-free-mode") === "true";
    const slideToClickedSlide = cmsWrap.getAttribute("data-slide-to-clicked") === "true";
    const centeredSlides = cmsWrap.getAttribute("data-centered-slides") === "true";
    const speed = +cmsWrap.getAttribute("data-speed") || 600;

    const swiper = new Swiper(cmsWrap, {
      slidesPerView: 1,
      followFinger,
      freeMode,
      slideToClickedSlide,
      centeredSlides,
      autoHeight: false,
      speed,
      loop: true,
      slideActiveClass: "is-active",
      slideDuplicateActiveClass: "is-active",
      mousewheel: {
        forceToAxis: true,
      },
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      navigation: {
        nextEl: component.querySelector(".team-slider_btn_element.is-next"),
        prevEl: component.querySelector(".team-slider_btn_element.is-prev"),
      },
      pagination: {
        el: component.querySelector(".review-slider_bullet_wrap"),
        bulletActiveClass: "is-active",
        bulletClass: "review-slider_bullet_item",
        bulletElement: "button",
        clickable: true,
      },
      scrollbar: {
        el: component.querySelector(".team-slider_draggable_wrap"),
        draggable: true,
        dragClass: "team-slider_draggable_handle",
        snapOnRelease: true,
      },
    });

    component.__swiper = swiper;
  });

  // Cleanup per distruggere Swiper in caso di transizione Barba
  scope.__swiperReviewCleanup = () => {
    components.forEach((component) => {
      try { component.__swiper?.destroy(true, true); } catch {}
      delete component.__swiper;
      delete component.dataset.scriptInitialized;
    });
  };
}

/***********************
 * FUNZIONI GENERALI
 ***********************/

// SIGNATURE STUDIO OLIMPO
function initSignature() {
  console.log("%cCredits: Studio Olimpo – https://www.studioolimpo.it", "background: #F8F6F1; color: #000; font-size: 12px; padding:10px 14px;");
}

// GET CURRENT YEAR
function initCurrentYear(scope = document) { 
  const currentYear = new Date().getFullYear();
  const currentYearElements = scope.querySelectorAll('[data-current-year]');
  currentYearElements.forEach((el) => {
    el.textContent = currentYear;
  });
}

// CURSOR CUSTOM
function initCustomCursor() {
  const cursor = document.querySelector(".cursor_wrap");
  if (!cursor) {
    return;
  }

  let cursorRevealed = false;
  gsap.set(cursor, { xPercent: -50, yPercent: -50 });

  cursor.classList.add("cursor_hide");

  let xTo = gsap.quickTo(cursor, "x", { duration: 0.7, ease: "power3.out" });
  let yTo = gsap.quickTo(cursor, "y", { duration: 0.7, ease: "power3.out" });

  window.addEventListener("mousemove", (e) => {
    xTo(e.clientX);
    yTo(e.clientY);

    if (!cursorRevealed) {
      cursor.classList.remove("cursor_hide");
      cursorRevealed = true;
    }
  });
}

// SAME PAGE CLICK
function preventSamePageClicks() {
  if (window.__samePageGuardBound) return;
  window.__samePageGuardBound = true;

  
  const normPath = (path) =>
    path
      .replace(/\/index\.html?$/i, "")
      .replace(/\/+$/g, "") || "/";

  
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;

    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    if (a.target === "_blank" || a.hasAttribute("download") || a.rel === "external") return;
    if (a.dataset.allowSame === "true") return;

    let dest;
    try { dest = new URL(a.getAttribute("href"), location.href); }
    catch { return; }

    if (dest.origin !== location.origin) return;

    const curPath  = normPath(location.pathname);
    const destPath = normPath(dest.pathname);
    const sameBase = (destPath === curPath) && (dest.search === location.search);

    if (!sameBase) return;

    if (dest.hash) {
      const targetEl = document.getElementById(dest.hash.slice(1)) || document.querySelector(dest.hash);
      if (targetEl) {
        e.preventDefault();
        if (window.lenis && typeof window.lenis.scrollTo === "function") {
          window.lenis.scrollTo(targetEl, { offset: 0 });
        } else {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      return;
    }

    e.preventDefault();
    if (window.lenis && typeof window.lenis.scrollTo === "function") {
      window.lenis.scrollTo(0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, true);
}


/***********************
 * FORM SUCCESS → Trigger Barba con pannello personalizzato
 ***********************/
function initFormSuccessTransition(scope = document) {
// Seleziona solo i form Webflow all’interno dello scope (utile per Barba)
  const $forms = $(scope).find(".w-form form");

  $forms.each(function () {
    const $form = $(this);
    if ($form.data("bound-success")) return;
    $form.data("bound-success", true);

    $form.on("submit", function () {
      setTimeout(() => {
        const $success = $form.closest(".w-form").find(".w-form-done");
        if ($success.length) {

          // 🔹 Nasconde messaggio di successo standard
          $success.hide();

          // 🔹 Mantiene visibile il form
          $form.show();

          // 🔹 Determina il tipo di form
          const formName = $form.attr("name") || "";
          let panelTarget = "#transition-default"; // default

          if (formName.toLowerCase().includes("newsletter")) {
            panelTarget = "#transition-newsletter";
          } else if (
            formName.toLowerCase().includes("contatti") ||
            formName.toLowerCase().includes("matrimoni") ||
            formName.toLowerCase().includes("eventi")
          ) {
            panelTarget = "#transition-contact";
          }

          // 🔹 Registra il pannello scelto
          window.__barbaTransitionTarget = panelTarget;

          console.log(`✅ Form inviato → ${formName} → pannello ${panelTarget}`);

          // 🔹 Avvia la transizione standard
          if (window.barba) barba.go("/");
        }
      }, 1200);
    });
  });
}


/***********************
 * ACCORDION COMPONENT — MATRIMONI & EVENTI
 ***********************/
function initAccordion(scope = document) {
  const components = scope.querySelectorAll(".accordion_wrap");
  if (!components.length) return;

  components.forEach((component, listIndex) => {
    if (component.dataset.scriptInitialized === "true") return;
    component.dataset.scriptInitialized = "true";

    const closePrevious = component.getAttribute("data-close-previous") !== "false";
    const closeOnSecondClick = component.getAttribute("data-close-on-second-click") !== "false";
    const openOnHover = component.getAttribute("data-open-on-hover") === "true";
    const openByDefault = component.hasAttribute("data-open-by-default")
      && !isNaN(+component.getAttribute("data-open-by-default"))
      ? +component.getAttribute("data-open-by-default")
      : false;

    const list = component.querySelector(".accordion_list");
    let previousIndex = null;
    const closeFunctions = [];

    // Rimuove il wrapper CMS dinamico per poter usare GSAP in modo pulito
    function removeCMSList(slot) {
      const dynList = Array.from(slot.children).find((child) => child.classList.contains("w-dyn-list"));
      if (!dynList) return;
      const nestedItems = dynList?.firstElementChild?.children;
      if (!nestedItems) return;
      const staticWrapper = [...slot.children];
      [...nestedItems].forEach(el => el.firstElementChild && slot.appendChild(el.firstElementChild));
      staticWrapper.forEach((el) => el.remove());
    }
    if (list) removeCMSList(list);

    component.querySelectorAll(".accordion_component").forEach((card, cardIndex) => {
      const button = card.querySelector(".accordion_toggle_button");
      const content = card.querySelector(".accordion_content_wrap");
      if (!button || !content) return console.warn("Accordion: elementi mancanti", card);

      button.setAttribute("aria-expanded", "false");
      button.setAttribute("id", `accordion_button_${listIndex}_${cardIndex}`);
      content.setAttribute("id", `accordion_content_${listIndex}_${cardIndex}`);
      button.setAttribute("aria-controls", content.id);
      content.setAttribute("aria-labelledby", button.id);
      content.style.display = "none";

      const refresh = () => {
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
      };

      const tl = gsap.timeline({
        paused: true,
        defaults: { duration: 0.5, ease: "power2.inOut" },
        onComplete: refresh,
        onReverseComplete: refresh
      });
      tl.set(content, { display: "block" });
      tl.fromTo(content, { height: 0 }, { height: "auto" });

      const closeAccordion = () => {
        if (card.classList.contains("is-active")) {
          card.classList.remove("is-active");
          tl.reverse();
          button.setAttribute("aria-expanded", "false");
        }
      };

      const openAccordion = (instant = false) => {
        if (closePrevious && previousIndex !== null && previousIndex !== cardIndex) {
          closeFunctions[previousIndex]?.();
        }
        previousIndex = cardIndex;
        button.setAttribute("aria-expanded", "true");
        card.classList.add("is-active");
        instant ? tl.progress(1) : tl.play();
      };

      closeFunctions[cardIndex] = closeAccordion;

      if (openByDefault === cardIndex + 1) openAccordion(true);

      button.addEventListener("click", () => {
        const isActive = card.classList.contains("is-active");
        if (isActive && closeOnSecondClick) {
          closeAccordion();
          previousIndex = null;
        } else {
          openAccordion();
        }
      });

      if (openOnHover) {
        button.addEventListener("mouseenter", () => openAccordion());
      }
    });
  });
}


/***********************
 * MODAL HANDLER — apertura automatica con controllo attributo
 ***********************/
function initModalAuto() {
  const modalSystem = ((window.lumos ??= {}).modal ??= {
    list: {},
    open(id) { this.list[id]?.open?.(); },
    closeAll() { Object.values(this.list).forEach((m) => m.close?.()); },
  });

  function createModals() {
    document.querySelectorAll(".modal_dialog").forEach(function (modal) {
      if (modal.dataset.scriptInitialized) return;
      modal.dataset.scriptInitialized = "true";

      const modalId = modal.getAttribute("data-modal-target");
      let lastFocusedElement;

      // GSAP timeline apertura/chiusura
      if (typeof gsap !== "undefined") {
        gsap.context(() => {
          let tl = gsap.timeline({ paused: true, onReverseComplete: resetModal });
          tl.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power2.out" });
          tl.fromTo(".modal_content", { yPercent: 10, filter: "blur(5px)" }, { yPercent: 0, filter: "blur(0px)", duration: 0.9, ease: "loader" }, "<");
          modal.tl = tl;
        }, modal);
      }

      function resetModal() {
        if (typeof lenis !== "undefined" && lenis.start) lenis.start();
        else document.body.style.overflow = "";
        modal.close();
        if (lastFocusedElement) lastFocusedElement.focus();
        window.dispatchEvent(new CustomEvent("modal-close", { detail: { modal } }));
      }

      function openModal() {
        if (typeof lenis !== "undefined" && lenis.stop) lenis.stop();
        else document.body.style.overflow = "hidden";
        lastFocusedElement = document.activeElement;
        modal.showModal();
        modal.querySelector(':focus')?.blur();
        if (typeof gsap !== "undefined") modal.tl.play();
        modal.querySelectorAll("[data-modal-scroll]").forEach((el) => (el.scrollTop = 0));
        window.dispatchEvent(new CustomEvent("modal-open", { detail: { modal } }));
      }

      function closeModal() {
        if (typeof gsap === "undefined") {
          resetModal();
          return;
        }

        const content = modal.querySelector(".modal_content");

        const tlClose = gsap.timeline({
          defaults: { ease: "power2.inOut", duration: 0.7 },
          onComplete: resetModal,
        });

        tlClose
          .to(content, { yPercent: -20, autoAlpha: 0, filter: "blur(5px)" }, 0.5)
          .to(modal, { opacity: 0, duration: 0.5 }, "<0.1");
      }

      // Eventi base
      modal.addEventListener("cancel", (e) => (e.preventDefault(), closeModal()));
      modal.addEventListener("click", (e) => e.target.closest("[data-modal-close]") && closeModal());
      modalSystem.list[modalId] = { open: openModal, close: closeModal };

      // 🔹 Apertura automatica condizionata
      const modalActive = modal.getAttribute("data-modal-active") === "true";
      if (modalActive) {
        setTimeout(() => {
          if (modal.getAttribute("data-modal-active") === "true") {
            openModal();
            console.log(`🟢 Modal "${modalId}" aperto automaticamente dopo 7s`);
          }
        }, 6000);
      } else {
        console.log(`⚪ Modal "${modalId}" disattivato (data-modal-active="false")`);
      }
    });
  }

  // Esegui subito e dopo ogni cambio pagina
  createModals();

  if (window.barba) {
    barba.hooks.afterEnter(() => {
      createModals();
    });
  }
}

/***********************
 * HERO — FUNZIONI SPECIFICHE
 ***********************/

// HERO HOME
function initHeroHome(scope = document) {
  const section = scope.querySelector('#section-hero');
  if (!section) return null;

  


  const overlay   = section.querySelector('.overlay_wrap');
  const bg      = section.querySelector('.u-background-skeleton');
  const eyebrow = section.querySelector('.eyebrow_text');
  const heading = section.querySelector('.c-heading');
  const para    = section.querySelector('.c-paragraph');
  const btns    = section.querySelector('.u-button-group');


  let overlayTarget = 0.6;
  if (overlay) {
    const comp = getComputedStyle(overlay);
    const parsed = parseFloat(comp.opacity);
    if (!Number.isNaN(parsed)) overlayTarget = parsed;
  }


  if (bg)      gsap.set(bg,      { scale: 1.08, willChange: 'transform, opacity' });
  if (overlay) gsap.set(overlay, { opacity: 0, willChange: 'opacity' });
  if (eyebrow) gsap.set(eyebrow, { autoAlpha: 0, yPercent: 30, filter: 'blur(5px)' });
  if (heading) gsap.set(heading, { autoAlpha: 0, yPercent: 20, filter: 'blur(5px)' });
  if (para)    gsap.set(para,    { autoAlpha: 0, yPercent: 20, filter: 'blur(5px)' });
  if (btns)    gsap.set(btns,    { autoAlpha: 0, yPercent: 20 });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (bg) {
    tl.to(bg,      { autoAlpha: 1, duration: 0.6 }, 0)
      .to(bg,      { scale: 1, duration: 1.4, ease: 'power2.out' }, 0);
  }
  if (overlay) {
    tl.to(overlay, { opacity: overlayTarget, duration: 1.0, ease: 'power2.out' }, 0.05);
  }

  if (eyebrow) tl.to(eyebrow, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.8 }, 0.2);
  if (heading) tl.to(heading, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.8 }, "<0.1");
  if (para)    tl.to(para,    { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.7 }, '<0.1');
  if (btns)    tl.to(btns,    { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.6 }, '<0.2');

  return tl;

}

// HERO VILLA
function initHeroVilla(scope = document) {
  const section   = scope.querySelector('#section-hero');
  if (!section) return null;

  const bg        = section.querySelector('.u-background-skeleton');
  const overlay   = section.querySelector('.overlay_wrap');
  const contain   = section.querySelector('.section_contain');

  const eyebrow   = section.querySelector('.eyebrow_wrap');
  const eMarker   = eyebrow?.querySelector('.eyebrow_marker');
  const eText     = eyebrow?.querySelector('.eyebrow_text');

  const heading   = section.querySelector('.c-heading');
  const para      = section.querySelector('.c-paragraph');
  const btns      = section.querySelector('.u-button-group');

  const grid      = section.querySelector('.c-grid');
  const gridItems = grid ? grid.querySelectorAll('img, .u-ratio-16-9, .grid_item') : [];

  let overlayTarget = 0.6;
  if (overlay) {
    const comp = getComputedStyle(overlay);
    const parsed = parseFloat(comp.opacity);
    if (!Number.isNaN(parsed)) overlayTarget = parsed;
  }

  if (bg)      gsap.set(bg,      { scale: 1.08, autoAlpha: 0, willChange: 'transform, opacity' });
  if (overlay) gsap.set(overlay, { opacity: 0, willChange: 'opacity' });
  if (contain) gsap.set(contain, { willChange: 'opacity, transform' });

  if (eMarker) gsap.set(eMarker, { scaleX: 0, transformOrigin: 'left center', willChange: 'transform' });
  if (eText)   gsap.set(eText,   { autoAlpha: 0, y: 8, willChange: 'opacity, transform' });

  if (heading) gsap.set(heading, { autoAlpha: 0, yPercent: 18, filter: 'blur(5px)', willChange: 'opacity, transform, filter' });
  if (para)    gsap.set(para,    { autoAlpha: 0, yPercent: 18, filter: 'blur(5px)', willChange: 'opacity, transform, filter' });
  if (btns)    gsap.set(btns,    { autoAlpha: 0, yPercent: 16, filter: 'blur(5px)', willChange: 'opacity, transform, filter' });

  if (gridItems.length) {
    gsap.set(gridItems, { autoAlpha: 0, yPercent: 8, willChange: 'opacity, transform' });
  }

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (bg) {
    tl.to(bg,      { autoAlpha: 1, duration: 0.6 }, 0)
      .to(bg,      { scale: 1, duration: 1.4, ease: 'power2.out' }, 0);
  }
  if (overlay) {
    tl.to(overlay, { opacity: overlayTarget, duration: 1.0, ease: 'power2.out' }, 0.05);
  }

  if (eMarker) tl.to(eMarker, { scaleX: 1, duration: 0.7, ease: 'power3.out' }, 0.1);
  if (eText)   tl.to(eText,   { autoAlpha: 1, y: 0, duration: 0.5 }, '<0.10');

  if (heading) tl.to(heading, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.8 }, 0.2);
  if (para)    tl.to(para,    { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.7 }, '<0.2');
  if (btns)    tl.to(btns,    { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.6 }, '<0.1');

  if (gridItems.length) {
    tl.to(gridItems, {
      autoAlpha: 1,
      yPercent: 0,
      duration: 0.6,
      stagger: { each: 0.1, from: 'start' }
    }, '<');
  }

  return tl;
}

// HERO CONTATTI
function initHeroContact(scope = document) {
  const section = scope.querySelector('#section-hero');
  if (!section) return null;

  console.log("✅ initHeroContact triggered");

  // Elementi principali
  const eyebrow   = section.querySelector('.eyebrow_wrap');
  const heading   = section.querySelector('.c-heading');
  const paragraph = section.querySelector('.c-paragraph');
  const contactList = section.querySelector('#contact-list');
  const form      = section.querySelector('.form_main_wrap');

  // Stati iniziali
  gsap.set([eyebrow, heading, paragraph, contactList, form], {
    autoAlpha: 0,
    yPercent: 10,
    filter: 'blur(6px)',
    willChange: 'opacity, transform'
  });

  // Timeline
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (eyebrow)
    tl.to(eyebrow, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.6 }, 0.3);

  if (heading)
    tl.to(heading, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1 }, "<0.1");

  if (paragraph)
    tl.to(paragraph, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1 }, "<0.09");

  if (contactList)
    tl.to(contactList, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1 }, "<0.3");

  if (form)
    tl.to(form, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.2 }, "<0.2");

  return tl;
}


// HERO 
function initHeroSingleExperience(scope = document) {
  const section = scope.querySelector('#section-hero');
  if (!section) return null;

  console.log("✅ initHeroSingleExperience triggered");

  // Elementi principali
  const eyebrowWraps = section.querySelectorAll('#eyebrow-wrap .eyebrow_wrap');
  const heading   = section.querySelector('.c-heading');
  const paragraph = section.querySelector('#paragraph-group');
  const visual      = section.querySelector('.split_alt_visual_mask');

  // Stati iniziali
  gsap.set(
    [eyebrowWraps, heading, paragraph, visual],
    {
      autoAlpha: 0,
      yPercent: 8,
      filter: 'blur(6px)',
      willChange: 'opacity, transform'
    }
  );

  // Timeline principale
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  // Eyebrow multipli (animati con stagger)
  if (eyebrowWraps.length > 0) {
    tl.to(eyebrowWraps, {
      autoAlpha: 1,
      yPercent: 0,
      filter: 'blur(0px)',
      duration: 0.6,
      stagger: 0.1
    }, 0.3);
  }

  if (heading) {
    tl.to(heading, {
      autoAlpha: 1,
      yPercent: 0,
      filter: 'blur(0px)',
      duration: 1
    }, "<0.1");
  }

  if (paragraph) {
    tl.to(paragraph, {
      autoAlpha: 1,
      yPercent: 0,
      filter: 'blur(0px)',
      duration: 0.8
    }, "<0.08");
  }

  if (visual) {
    tl.to(visual, {
      autoAlpha: 1,
      yPercent: 0,
      filter: 'blur(0px)',
      duration: 0.9
    }, "<0.2");
  }

  return tl;
}


/* Stubs NON mappati (solo log, nessuna TL) */
// function initHeroWedding(scope = document) {
// if (!scope.querySelector('#hero-matrimoni')) return null;
//   return null;
// }
// function initHeroPrivateEvent(scope = document) {
//   if (!scope.querySelector('#hero-private-event')) return null;
//   return null;
// }
// function initHeroRestaurant(scope = document) {
//   if (!scope.querySelector('#hero-restaurant')) return null;
//   return null;
// }
// function initHeroExperience(scope = document) {
//   if (!scope.querySelector('#hero-experience')) return null;
//   return null;
// }


/***********************
 * HERO REGISTRY + BUILDER
 ***********************/
const HERO_BUILDERS = {
  home:  initHeroHome,
  villa: initHeroHome,
  matrimoni: initHeroHome,
  eventi: initHeroHome,
  // restaurant: initHeroRestaurant,
  esperienze: initHeroHome,
  esperienza: initHeroSingleExperience,
  contatti: initHeroContact,
  err404: initHeroContact,
};

function buildHeroForNamespace(ns, scope) {
  const fn = HERO_BUILDERS[ns];
  if (typeof fn !== 'function') {
    console.log(`[HERO] nessuna animazione per "${ns}" → skip`);
    return null;
  }
  try {
    const tl = fn(scope);
    if (tl && typeof tl.add === 'function') return tl;
    return null;
  } catch (e) {
    console.warn(`[HERO] errore nella hero "${ns}" → skip`, e);
    return null;
  }
}

/***********************
 * LOADER
 ***********************/
function initLoader(opts = {}) {
  const {
    minDuration = 600,
    selLetters   = ".loader_logo_letter",
    selLogo      = ".loader_logo",
    selText      = ".loader_text",
    selProgress = ".loader_progress_text",
    selStar     = "#spinstar",
    easeOut2   = "power2.out",
    easeText    = "power3.out",
    ease3     = "power3.inOut",
    onReady = null,
    onBeforeHide = null
  } = opts;

  if (initLoader._running) return initLoader._running;

  const wrap = document.querySelector(".loader_wrap");
  if (!wrap) return Promise.resolve();

  // prevent flicker
  wrap.classList.remove("is-hidden");
  wrap.setAttribute("aria-hidden", "false");
  gsap.set(wrap, { display: "block", opacity: 1, visibility: "visible", pointerEvents: "all", clearProps: "y" });

  // now that the loader is visible, stop lenis and force scroll to top (avoids pre-loader jump)
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch {}
  try { window.lenis?.stop(); } catch {}
  try {
    window.lenis?.scrollTo?.(0, { immediate: true });
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } catch {}

  const logoEl = document.querySelector(selLogo);
  if (logoEl) logoEl.style.visibility = "visible";

  // Query
  const letters   = wrap.querySelectorAll(selLetters);
  const logo = wrap.querySelectorAll(selLogo);
  const texts     = wrap.querySelectorAll(selText);
  const progressEl = wrap.querySelector(selProgress);
  const starEl     = wrap.querySelector(selStar);
  const progressWrap = wrap.querySelector(".loader_progress");
  const transitionIcon = wrap.querySelector(".transition_icon");
  const main = document.querySelector('[data-barba="container"]');

  // Initial state
  if (logo)             gsap.set(logo, { autoAlpha: 0, y: "1rem", willChange: "opacity, transform" });
  if (texts.length)     gsap.set(texts,     { autoAlpha: 0, y: "0.5rem", willChange: "opacity, transform" });
  // if (letters.length)   gsap.set(letters,   { yPercent: 110, willChange: "transform" });
  if (progressWrap)     gsap.set(progressWrap, { autoAlpha: 0 });
  if (starEl)           gsap.set(starEl,    { autoAlpha: 0, rotation: 0, transformOrigin: "center center", willChange: "transform, opacity" });

  // Unlock prevent flicker
  const flickerEls = wrap.querySelectorAll("[data-prevent-flicker='true']");
  if (flickerEls.length) gsap.set(flickerEls, { visibility: "visible" });

  //  gsap.set(main, {yPercent: 20});

  const startTime = performance.now();

  // Timeline loader
  const tl = gsap.timeline({ defaults: {}, paused: true });

  // Loader progressivo numerico
  const counter = { value: 0 };
  const loaderDuration = 1.8; // durata caricamento

  // Aggiorna il testo con la percentuale
  function updateLoaderText() {
    const progress = Math.round(counter.value);
    if (progressEl) progressEl.textContent = `${progress}%`;
  }

  if (logo) {
    tl.to(logo, { autoAlpha: 1, y: 0, duration: 1.4, ease: easeOut2 }, 0);
  }

  if (texts.length) {
    tl.to(texts, { autoAlpha: 1, y: 0, duration: 1.4, ease: easeOut2 }, "<0.6");
  }

  // Fade-in del wrapper loader_progress + transition_icon
  if (progressWrap) {
    tl.fromTo(
      progressWrap,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.6, ease: "loader" },
      "<"
    );
    // Fade-in transition_icon (same timing and ease as progressWrap)
    if (transitionIcon) {
      tl.fromTo(
        transitionIcon,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.6, ease: "loader" },
        "<" // syncs with progressWrap fade-in
      );
    }
  }

  // Animazione del counter dopo il fade-in
  tl.to(counter, {
    value: 100,
    duration: loaderDuration,
    ease: "loader",
    onUpdate: updateLoaderText
  }, "<");

  // Fade-in e rotazione stella (in contemporanea al counter)
  if (starEl) {
    tl.to(
      starEl,
      { autoAlpha: 1, duration: 0.3, ease: easeOut2 },
      "<0.1"
    );
    tl.to(
      starEl,
      { rotation: 380, duration: 1.5, ease: "spinStar", transformOrigin: "center center"},
      "<0.4"
    );
  }

  if (typeof onBeforeHide === "function") {
    tl.add(onBeforeHide, "+=0.1");
  }

  tl.to(wrap, { y: "-100%", duration: 1, ease: "loaderPanel" }, "+=0.1");
  // tl.fromTo(main, {yPercent: 2}, {yPercent:0, ease: "loaderPanel", duration: 1.2}, "<")
    // .set(main, { clearProps: "transform" });

  tl.add(() => {
    gsap.set(wrap, { clearProps: "y" });
    wrap.classList.add("is-hidden");
    wrap.setAttribute("aria-hidden", "true");
    gsap.set(wrap, { opacity: 0, visibility: "hidden", pointerEvents: "none" });
    try { window.lenis?.start(); } catch {}
  });

  const ready = (document.fonts?.ready || Promise.resolve())
    .then(() => new Promise(requestAnimationFrame));

  initLoader._running = ready.then(() => {
    const elapsed = performance.now() - startTime;
    const wait = Math.max(0, minDuration - elapsed);

    return new Promise((resolve) => {
      setTimeout(() => {
        if (typeof onReady === "function") {
          try { onReady(); } catch {}
        }
        tl.eventCallback("onComplete", () => {
          initLoader._running = null;
          resolve();
        });
        tl.play(0);
      }, wait);
    });
  });

  return initLoader._running;
}


/***********************
 * RESET WEBFLOW
 * Reinizializza IX2 e altri componenti Webflow dopo ogni transizione Barba
 ***********************/
// function resetWebflow(data) {
//   const parser = new DOMParser();
//   const doc = parser.parseFromString(data.next.html, "text/html");
//   const webflowPageId = doc.querySelector("html")?.getAttribute("data-wf-page");

//   // Aggiorna ID pagina Webflow
//   if (webflowPageId) {
//     document.documentElement.setAttribute("data-wf-page", webflowPageId);
//   }

//   // Reinizializza le interazioni Webflow IX2
//   if (window.Webflow) {
//     try {
//       window.Webflow.destroy?.();
//       window.Webflow.ready?.();

//       const ix2 = window.Webflow.require?.("ix2");
//       if (ix2 && typeof ix2.init === "function") {
//         ix2.init();
//       }

//       window.Webflow.redraw?.up?.();
//       console.log("✅ Webflow IX2 reinitialized");
//     } catch (err) {
//       console.warn("⚠️ Errore nella reinizializzazione di Webflow:", err);
//     }
//   }

//   // Rimuove e riapplica la classe 'w--current' ai link corretti
//   document.querySelectorAll(".w--current").forEach(el => el.classList.remove("w--current"));
//   document.querySelectorAll("a").forEach(link => {
//     if (link.getAttribute("href") === window.location.pathname) {
//       link.classList.add("w--current");
//     }
//   });

//   // Riesegue eventuali script inline personalizzati con attributo data-barba-script
//   doc.querySelectorAll("[data-barba-script]").forEach((scriptEl) => {
//     let codeString = scriptEl.textContent || "";
//     if (codeString.includes("DOMContentLoaded")) {
//       codeString = codeString
//         .replace(/window\.addEventListener\("DOMContentLoaded",.*?=>\s*{/, "")
//         .replace(/}\);?$/, "");
//     }

//     const newScript = document.createElement("script");
//     newScript.type = "text/javascript";
//     const srcAttr = scriptEl.getAttribute("src");
//     if (srcAttr) {
//       newScript.src = srcAttr;
//     } else {
//       newScript.textContent = codeString;
//     }

//     document.body.appendChild(newScript);
//     newScript.remove();
//   });

//   console.log("🔁 Webflow reset completato");
// }

function resetWebflow(data) {
  if (typeof window.Webflow === "undefined") return;

  try {
    // Aggiorna ID pagina Webflow
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.next.html, "text/html");
    const webflowPageId = doc.querySelector("html")?.getAttribute("data-wf-page");
    if (webflowPageId) {
      document.documentElement.setAttribute("data-wf-page", webflowPageId);
    }

    // Distruggi e reinizializza Webflow
    window.Webflow.destroy?.();

    setTimeout(() => {
      try {
        window.Webflow.ready?.();

        // 🔹 Reinizializza IX2 (interazioni)
        const ix2 = window.Webflow.require?.("ix2");
        if (ix2 && typeof ix2.init === "function") {
          ix2.init();
          console.log("✅ Webflow IX2 reinitialized");
        } else {
          console.log("⚠️ Webflow IX2 non disponibile, salto init");
        }

        // 🔹 Reinizializza Forms se serve (per sicurezza nei submit)
        const forms = window.Webflow.require?.("forms");
        if (forms && typeof forms.ready === "function") {
          forms.ready();
          console.log("✅ Webflow Forms reinitialized");
        }

        window.Webflow.redraw?.up?.();
      } catch (innerErr) {
        console.warn("⚠️ Errore durante il reset Webflow:", innerErr);
      }
    }, 100); // leggero delay per sicurezza

    // // Ripristina classi w--current
    // document.querySelectorAll(".w--current").forEach(el => el.classList.remove("w--current"));
    // document.querySelectorAll("a").forEach(link => {
    //   if (link.getAttribute("href") === window.location.pathname) {
    //     link.classList.add("w--current");
    //   }
    // });

    console.log("🔁 Webflow reset completato");
  } catch (err) {
    console.warn("⚠️ Errore nella reinizializzazione di Webflow:", err);
  }
}



/***********************
 * BARBA INIT — transizione + transition_title + heading reveal + parallax + HERO modulari
 ***********************/
barba.init({
  debug: true,
  preventRunning: true,

  transitions: [
    {
      name: "default",
      sync: false,
      timeout: 8000,

        // ONCE — sposta su
once: async ({ next }) => {
  const scope = next?.container || document;

  // 🔹 Determina subito il namespace e aggiorna immediatamente la navbar (tema + stato corrente)
  let ns = next?.container?.dataset?.barbaNamespace;
  if (!ns) {
    const u = new URL(window.location.href);
    const path = u.pathname.replace(/^\/en\//, "").replace(/\/$/, "");
    ns = pathToNamespace(path);
    console.warn("⚠️ Namespace mancante, fallback usato:", ns);
  }
  applyNavbarStartTheme(ns);
  const startTheme = getStartThemeForNs(ns);
  forceNavbarThemeImmediate(startTheme);
  updateCurrentNav(ns);

  // 1) Lenis prima di tutto (e poi lo stoppi per il loader)
  initLenis();
  try { window.lenis?.stop(); } catch {}

  // 2) Ora è sicuro creare i trigger e le inizializzazioni globali
  initMenu(startTheme);
  initSectionReveal(scope);
  initGlobalParallax(scope);
  initGlobalSlider(scope);
  // initAnimateThemeScroll(scope);
  initCurrentYear(scope);
  initSignature();
  initCustomCursor();
  preventSamePageClicks();
  initFormSuccessTransition();
  initModalAuto();
  initLanguageSwitcher();
  updateLangSwitcherLinks();

  if (ns === "matrimoni") {
    initSliderReview(next.container);
  }

  // 🔹 Inizializza i trigger tema-navbar dopo un leggero delay per evitare marker al top
  gsap.delayedCall(0.1, () => {
    applyNavbarStartTheme(ns);
    initNavbarThemeScroll(ns);
  });

  // 3) Prepara hero ma in pausa
  const heroTl = buildHeroForNamespace(ns, scope);
  if (heroTl) heroTl.pause(0);

  const loaderDone = initLoader({
    onBeforeHide: () => {
      gsap.delayedCall(0.3, () => heroTl?.play(0));
    }
  });

  // 🔹 Riallineamento navbar immediato PRIMA del termine del loader
  forceNavbarThemeImmediate(startTheme);
  updateCurrentNav(ns);
  initNavbarThemeScroll(ns);
  refreshScrollTrigger(0.3);

  await loaderDone;
},

      /* Uscita pagina corrente */
      leave(data) {
        // Determina quale pannello usare
        let panelEl;

        if (window.__barbaTransitionTarget) {
          panelEl = document.querySelector(window.__barbaTransitionTarget);
          console.log("🎯 Pannello personalizzato:", window.__barbaTransitionTarget);
          window.__lastTransitionPanel = panelEl;
          delete window.__barbaTransitionTarget;
        } else {
          panelEl = document.querySelector("#transition-default");
          console.log("🎯 Pannello standard (default)");
          window.__lastTransitionPanel = panelEl;
        }

        const sealEl = panelEl?.querySelector(".transition_seal");
        const titleEl = panelEl?.querySelector(".transition_title");
        const textEl = panelEl?.querySelector(".transition_text");
        const starTopEl = panelEl?.querySelector("#spinstartop");
        // 🔹 Imposta il titolo a "Grazie" se il pannello non è quello di default
        let nextLabel = getNextLabel(data);
        if (panelEl && panelEl.id !== "transition-default") {
          nextLabel = "Grazie";
        }
        if (titleEl) titleEl.textContent = nextLabel || "";


        return gsap.timeline({ defaults: { ease: "loader", duration: 1 }})
          .set(panelEl, { display: "block", visibility: "visible", yPercent: 100 })
          .to(data.current.container, { y: "-15vh" }, "<")
          .to(panelEl, { yPercent: 0 }, "<")
          // Animazione transition_seal (solo autoAlpha)
          .fromTo(
            sealEl,
            { autoAlpha: 0, },
            { autoAlpha: 1, duration: 1.5, ease: 'power1.inOut' },
            '<0.3'
          )
          .fromTo(
              titleEl,
                { y: "2rem", autoAlpha: 0, willChange: "opacity, transform" },
                { y: "0rem", autoAlpha: 1, duration: 1, ease: "power2.out", clearProps: "willChange" },
                "<0.1"
          )
          .fromTo(
              textEl,
              { y: "0.5rem", autoAlpha: 0, willChange: "opacity, transform" },
              { y: "0rem", autoAlpha: 1, duration: 1, ease: "power2.out", clearProps: "willChange" },
              "<0.4"
          )
          .add(() => {
            if (starTopEl) gsap.set(starTopEl, { rotation: 0 });
          }, 0)
          .fromTo(
              starTopEl,
              { rotation: 0 },
              { rotation: 380, duration: 1.5, ease: 'spinStar', transformOrigin: 'center center'},
              0
          )
          // cleanup completo dopo il sipario
          .add(() => {
            if (typeof data.current.container.__swiperCleanup === "function") {
              data.current.container.__swiperCleanup();
              delete data.current.container.__swiperCleanup;
            }

            if (typeof data.current.container.__parallaxCleanup === "function") {
              data.current.container.__parallaxCleanup();
              delete data.current.container.__parallaxCleanup;
            }

            ScrollTrigger.getAll().forEach(t => {
              if (data.current.container.contains(t.trigger)) t.kill();
            });

            pauseAndResetVideos(data.current.container);

            destroyLenis();
          })
  
      .set(data.current.container, { display: "none" });
      },
      
      enter(data) {
  // Decidi quale wrapper usare per la transizione: custom o default
  // 🔹 Recupera il pannello usato nella transizione precedente
  const panelEl = window.__lastTransitionPanel || document.querySelector("#transition-default");
  const wrap = panelEl;
  const starBottomEl = wrap?.querySelector("#spinstarbottom");

  // 🔹 Delay personalizzato per transizioni specifiche
  let nextDelay = 0;
  const targetId =
    window.__barbaTransitionTarget ||
    window.__lastTransitionPanel?.id ||
    "#transition-default";

  if (
    targetId === "#transition-contact" ||
    targetId === "#transition-newsletter" ||
    targetId === "transition-contact" ||
    targetId === "transition-newsletter"
  ) {
    nextDelay = 5;
  }

  const tl = gsap.timeline({ defaults: { ease: "loader", duration: 1.2 } })
    .add(() => {
      if (starBottomEl) gsap.set(starBottomEl, { rotation: 0 });
    }, 0)
    .fromTo(
      starBottomEl,
      { rotation: 0 },
      { rotation: 360, duration: 1.3, ease: 'spinStar', transformOrigin: 'center center'},
    )
    .from(data.next.container, { y: "15vh", delay: nextDelay }, "<0.2")
    .to(wrap, { yPercent: -100 }, "<")
    .set(wrap, { yPercent: 100, display: "none", visibility: "hidden" });

  // sovrapponi la hero del namespace in ingresso solo se esiste
  try {
    let ns = data?.next?.container?.dataset?.barbaNamespace;
    if (!ns) {
      const u = new URL(window.location.href);
      const path = u.pathname.replace(/^\/en\//, "").replace(/\/$/, "");
      ns = pathToNamespace(path);
      console.warn("⚠️ Namespace mancante, fallback usato:", ns);
    }
    const heroTl = buildHeroForNamespace(ns, data.next.container);
    if (heroTl) {
      tl.add(heroTl, "-=0.7");
    }
  } catch {}

  // Reset flag dopo uso
  if (window.__barbaTransitionTarget) {
    window.__barbaTransitionTarget = null;
  }

  return tl;
}
    }
  ],
  views: [
    {
      namespace: "home",
      afterEnter({ next }) {
        const scope = next?.container || document;
        // initSectionReveal(scope)
      },
    },
    {
      namespace: "villa",
      afterEnter({ next }) {
        const scope = next?.container || document;
        // initHeroVilla(scope) (già gestita in enter via registry)
        // initSectionReveal(scope)
      },
    },
    {
      namespace: "matrimoni",
      afterEnter({ next }) {
        const scope = next?.container || document;
        initSliderReview(scope);
        initAccordion(scope);
      },
    },
    {
      namespace: "eventi",
      afterEnter({ next }) {
        const scope = next?.container || document;
        initAccordion(scope);
      },
    },
    {
      namespace: "ristorante",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "esperienze",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "esperienza",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "contatti",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "err404",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
  ]
});

// 🕓 Hook globale per ritardare l'avvio di leave se viene da un modal
barba.hooks.beforeLeave(async () => {
  
    // 🔹 Se esiste un modal aperto, chiudilo e attendi prima di procedere
  const openModal = document.querySelector(".modal_dialog[open]");
  if (openModal) {
    console.log("🟡 Modal aperto → chiusura e ritardo transizione");
    lumos.modal.closeAll();
    await new Promise((resolve) => setTimeout(resolve, 600)); // attende 0.2s reali
  }

});

// Aggiorna lo stato "current" nella navbar basandosi sul namespace attivo
function updateCurrentNav(currentNs) {
  // Reset di tutti i link
  document.querySelectorAll('.nav_links_item').forEach(item => {
    item.classList.remove('is-current');
    const icon = item.querySelector('.nav_links_icon');
    if (icon) gsap.set(icon, { autoAlpha: 0, display: 'none' });
  });

  // Trova il link corrispondente al namespace
  const activeItem = document.querySelector(`#${currentNs}`);
  if (activeItem) {
    activeItem.classList.add('is-current');
    const icon = activeItem.querySelector('.nav_links_icon');

    // Mostra e anima l’icona (che di base è display:none)
    if (icon) {
      gsap.set(icon, { display: 'block' });
      gsap.fromTo(
        icon,
        { autoAlpha: 0, y: '0.2rem' },
        { autoAlpha: 1, y: '0', duration: 0.4, ease: 'power2.out', clearProps: 'display' }
      );
    }
  }
}

// ================================
// BARBA HOOKS ottimizzati
// ================================

// Disattiva e riattiva gli ScrollTrigger globali
function disableScrollTriggers() {
  ScrollTrigger.getAll().forEach(st => st.disable(false));
}
function enableScrollTriggers() {
  ScrollTrigger.getAll().forEach(st => st.enable(false));
}

barba.hooks.beforeEnter((data) => {
  const scope = data?.next?.container || document;
  const nextNs = data?.next?.container?.dataset?.barbaNamespace;

  // 🔹 Aggiorna subito navbar (tema + attivo)
  if (nextNs) {
    const startTheme = getStartThemeForNs(nextNs);
    forceNavbarThemeImmediate(startTheme);
    updateCurrentNav(nextNs);
  }

  
  initHideNavbarOnScroll(50);

  // 🔹 Disattiva temporaneamente tutti gli ScrollTrigger
  disableScrollTriggers();

  // 🔹 Inizializzazioni globali
  initAutoPlayVideos(scope);
  initLenis();
  initSectionReveal(scope);
  initGlobalParallax(scope);
  initGlobalSlider(scope);
  forceNextPageToTop();
});

barba.hooks.enter((data) => {
  if (typeof resetWebflow === "function") resetWebflow(data);
});

barba.hooks.afterEnter((data) => {
  const nextNs = data?.next?.container?.dataset?.barbaNamespace;
  const scope = data?.next?.container || document;

  // 🔹 Inizializza moduli di base
  initFormSuccessTransition();
  initCurrentYear(scope);

  // 🔹 Riattiva gli ScrollTrigger globali
  enableScrollTriggers();
  initLanguageSwitcher();
  updateLangSwitcherLinks();

  // 🔹 Primo sync immediato (in caso di layout statico)
  gsap.delayedCall(0.1, () => {
    if (window.lenis) window.lenis.raf(performance.now());
    ScrollTrigger.refresh(true);
    console.log("⚡ ScrollTrigger refresh iniziale (0.1s)");
  });

  // 🔹 Sync principale — dopo stabilizzazione di Lenis + DOM
  gsap.delayedCall(0.35, () => {
    if (window.lenis) window.lenis.raf(performance.now());
    ScrollTrigger.refresh(true);
    console.log("✅ Lenis + ScrollTrigger refresh sincronizzato (0.35s)");

    // Inizializza qui i trigger della navbar per evitare marker al top
    if (nextNs) {
      initNavbarThemeScroll(nextNs);
      updateCurrentNav(nextNs);
    }
  });

  // 🔹 Secondo refresh extra di sicurezza dopo 0.8s
  gsap.delayedCall(0.5, () => {
    if (window.lenis) window.lenis.raf(performance.now());
    ScrollTrigger.refresh(true);
    console.log("🔁 Final ScrollTrigger refresh complete (0.8s)");
  });
});
