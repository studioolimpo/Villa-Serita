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
const NAMESPACE_TITLES = {
  home: "Home",
  about: "About",
  single_event: "Vivi la tua esperienza o momento speciale"
};


/* Utils */
function parseHTML(html) {
  try { return new DOMParser().parseFromString(html || "", "text/html"); }
  catch { return null; }
}

function labelFromNamespace(ns) {
  if (!ns) return "";
  const key = ns.trim().toLowerCase();
  return NAMESPACE_TITLES[key] || key
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, m => m.toUpperCase());
}

function deriveLabelFromURL(urlLike) {
  try {
    const u = typeof urlLike === "string"
      ? new URL(urlLike, location.origin)
      : (urlLike?.url ? new URL(urlLike.url, location.origin) : new URL(location.href));
    const seg = (u.pathname.split("/").filter(Boolean).pop() || "home").toLowerCase();
    return labelFromNamespace(seg);
  } catch { return ""; }
}

// optional
const USE_URL_SEGMENT_FOR = new Set(["single_event"]);

function lastSegmentTitle(urlLike) {
  try {
    const u = typeof urlLike === "string"
      ? new URL(urlLike, location.origin)
      : (urlLike?.url ? new URL(urlLike.url, location.origin) : new URL(location.href));
    const segRaw = (u.pathname.split("/").filter(Boolean).pop() || "").trim();
    const seg = decodeURIComponent(segRaw);
    if (!seg) return "";
    const nice = seg.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    return nice.replace(/\b\w/g, m => m.toUpperCase());
  } catch { return ""; }
}

function getNextNamespace(data) {
  const nsAttr = data?.next?.container?.getAttribute?.("data-barba-namespace");
  if (nsAttr) return nsAttr.trim().toLowerCase();

  const doc = parseHTML(data?.next?.html);
  const nsDoc = doc?.querySelector('[data-barba="container"]')?.getAttribute("data-barba-namespace");
  if (nsDoc) return nsDoc.trim().toLowerCase();

  if (data?.next?.namespace) return data.next.namespace.trim().toLowerCase();

  const urlNs = deriveLabelFromURL(data?.next?.url || "");
  return (urlNs || "").toLowerCase();
}

function getNextLabel(data) {
  const doc = parseHTML(data?.next?.html);

  const explicit = doc?.querySelector(".transition-title")?.textContent?.trim();
  if (explicit) return explicit;

  const ns = getNextNamespace(data);
  if (ns) {
    if (USE_URL_SEGMENT_FOR.has(ns)) {
      const segTitle = lastSegmentTitle(data?.next?.url || location.href);
      if (segTitle) return segTitle;
    }
    const mapped = NAMESPACE_TITLES[ns];
    if (mapped) return mapped;
  }

  const fromTitle = doc?.querySelector("title")?.textContent?.trim();
  if (fromTitle) return fromTitle;

  const segFallback = lastSegmentTitle(data?.next?.url || location.href);
  if (segFallback) return segFallback;

  return deriveLabelFromURL(data?.next?.url || "");
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
 * NAV MENU
 ***********************/
function initMenu() {
    
    gsap.defaults({
      ease: "main",
      duration: 0.7
    });

    let navWrap = document.querySelector(".nav_menu_wrap");
    let state = navWrap.getAttribute("data-nav");
    let overlay = navWrap.querySelector(".nav_menu_overlay");
    let menu = navWrap.querySelector(".nav_menu_wrapper");
    let menuLayout = navWrap.querySelector(".nav_menu_layout");
    let bgPanels = navWrap.querySelectorAll(".nav_menu_panel");
    let menuToggles = document.querySelectorAll("[data-menu-toggle]");
    let menuLinks = navWrap.querySelectorAll(".nav_menu_link");
    let menuLanguage = navWrap.querySelector(".nav_menu_language");
    let menuButton = document.querySelector(".menu_button_wrap");
    let menuButtonLayout = menuButton.querySelectorAll(".menu_button_layout");
    // let menuDivider = navWrap.querySelectorAll(".nav_menu_divider");
    let menuInfo = navWrap.querySelector(".nav_menu_content");
    let navTransition = navWrap.querySelector(".nav_menu_transition");

    let tl = gsap.timeline();

    const openNav = () => {
      navWrap.setAttribute("data-nav", "open");
      tl.clear()
        .set(navWrap, { display: "block" })
        .set(menuLanguage, { autoAlpha: 0, yPercent: 5 }, "<")
        .set(menuInfo, { autoAlpha: 0, yPercent: 5 }, "<")
        .set(menu, { yPercent: 0 }, "<")
        .set(menuLayout, { opacity: 1 }, "<")
        .set(navTransition, { autoAlpha: 0 }, "<")
        .fromTo(menuButtonLayout, { yPercent: 0 }, { yPercent: -120, duration: 0.7, ease: "power3.out"}, "<")
        .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, "<")
        .fromTo(bgPanels, { yPercent: -101 }, { yPercent: 0, duration: 1.2, ease:"bgPanelEase"  }, "<");
      // Always re-select main to ensure it's fresh after Barba transitions
      let main = document.querySelector('[data-barba="container"]');
      tl.fromTo(main, {yPercent: 0},{yPercent: 2, duration: 1.2, ease: "bgPanelEase" },"<")
        .fromTo(menuLanguage, { yPercent: 20, autoAlpha: 0 }, { yPercent: 0, autoAlpha:1 }, "<0.3")
        .fromTo(menuLinks, { autoAlpha: 0, yPercent: 5 }, { autoAlpha: 1, yPercent: 0, duration: 1.2, stagger: 0.09 }, "<0.1")
        .fromTo(menuInfo, { yPercent: 5, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1 }, "<0.4");

    };

    const closeNav = () => {
      navWrap.setAttribute("data-nav", "closed");
      tl.clear();

      const main = document.querySelector('[data-barba="container"]');

      tl.to(overlay, { autoAlpha: 0 })
        .to(menuLayout, { opacity: 0, yPercent: 5, duration: 1, ease:"power2.out" }, 0)
        .to(main, { yPercent: 0, duration: 1.2, ease: "bgPanelEase" }, "<")
        .to(menu, { yPercent: -110, duration: 1, ease: "bgPanelEase" }, "<")
        .to(menuButtonLayout, { yPercent: 0 }, "<")
        .set(navWrap, { display: "none" });
    };

    const transitionNav = () => {
        navWrap.setAttribute("data-nav", "closed");
        tl.clear()
          .to(overlay, { autoAlpha: 0, delay: 0.1 })
          //.to(navTransition, { autoAlpha: 1, duration: 0.5 }, "<")
          .to(menu, { yPercent: -110, duration: 1.2 , ease: "power2.in" }, "<0.2")
          .to(menuButtonLayout, { yPercent: 0, duration: 1, ease: "bgPanelEase" }, "<0.2")
          .set(navWrap, { display: "none" });
        // Always re-select main to ensure it's fresh after Barba transitions
        let main = document.querySelector('[data-barba="container"]');
        tl.to(main, { y: 0, duration: 0.6 }, "<");

        window.__navJustClosed__ = true;
      };

    menuToggles.forEach((toggle) => {
      toggle.addEventListener("click", () => {
        state = navWrap.getAttribute("data-nav");
        if (state === "open") {
          closeNav();
          lenis.start();
        } else {
          openNav();
          lenis.stop();
        }
      });
    });

    $("a").on("click", function (e) {
      const href = $(this).attr("href");
      const isSameHost = $(this).prop("hostname") === window.location.host;
      const isNotHash = href.indexOf("#") === -1;
      const isNotBlank = $(this).attr("target") !== "_blank";
      const isNavOpen = navWrap.getAttribute("data-nav") === "open";
      const isLangSwitcher = $(this).closest(".footer_switcher_wrapper").length > 0;

      const currentPath = window.location.pathname.replace(/\/$/, "");
      const targetPath = new URL(href, window.location.origin).pathname.replace(/\/$/, "");

      if (isSameHost && isNotHash && isNotBlank && isNavOpen && !isLangSwitcher) {
        if (currentPath === targetPath) {
          e.preventDefault();
          closeNav();
          lenis.start();
        } else {
          e.preventDefault();
          transitionNav();
          lenis.start();
        }
      }
    });

// if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
//     const listItems = navWrap.querySelectorAll(".nav_menu_link");
//     const imageItems = document.querySelectorAll(".nav_visual_item");

//     if (listItems.length && imageItems.length) {
//       gsap.set(imageItems, { autoAlpha: 0 });

//       listItems.forEach((listItem, i) => {
//         listItem.addEventListener("mouseenter", () => {
//           imageItems.forEach((img, index) => {
//             gsap.killTweensOf(img);
//             gsap.to(img, {
//               autoAlpha: index === i ? 1 : 0,
//               duration: 0.5,
//               overwrite: true
//             });
//           });
//         });

//         listItem.addEventListener("mouseleave", () => {
//           imageItems.forEach((img) => {
//             gsap.killTweensOf(img);
//             gsap.to(img, {
//               autoAlpha: 0,
//               duration: 0.3,
//               overwrite: true
//             });
//           });
//         });
//       });
//     }
//   }
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
        markers: true,
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
function initAnimateThemeScroll(scope = document) {
  const root = scope instanceof Element ? scope : document;

  root.querySelectorAll("[data-animate-theme-to]").forEach((el) => {
    const theme = el.getAttribute("data-animate-theme-to");
    const brand = el.getAttribute("data-animate-brand-to");

    ScrollTrigger.create({
      trigger: el,
      start: "top center",
      end:   "bottom center",
      onToggle: ({ isActive }) => {
        if (isActive && window.colorThemes && typeof window.colorThemes.getTheme === "function") {
          gsap.to("body", { ...colorThemes.getTheme(theme, brand) });
        }
      }
    });
  });
}

/***********************
 * THEME RESET → LIGHT
 ***********************/
function resetThemeToLight(opts = {}) {
  const {
    brand = "default",
    duration = 0.6,
    ease = "power2.out"
  } = opts;

  // se non c’è colorThemes o getTheme, esco silenziosamente
  if (!window.colorThemes || typeof window.colorThemes.getTheme !== "function") return;

  const vars = window.colorThemes.getTheme("light", brand);
  if (!vars || typeof vars !== "object") return;

  gsap.to("body", { ...vars, duration, ease, overwrite: "auto" });
}



/***********************
 * NAVBAR THEME HANDLER
 * Gestisce il cambio tema della navbar (dark → light) in base al namespace
 ***********************/
const navbarThemeTriggers = {
  home: { startTheme: "dark", trigger: "#section-hero" },
  villa: { startTheme: "dark", trigger: "#section-hero" },
  matrimoni: { startTheme: "dark", trigger: "#section-hero" },
  eventi: { startTheme: "dark", trigger: "#section-hero" },
  ristorante: { startTheme: "dark", trigger: "#section-hero" },
  esperienze: { startTheme: "dark", trigger: "#section-hero" },
};

function initNavbarTheme(namespace, retryCount = 0) {
  // Pulizia base
  try {
    ScrollTrigger.getAll().forEach(st => {
      if (st.vars.id === "navbar-theme") st.kill();
    });
    ScrollTrigger.clearMatchMedia();
  } catch (err) {
    console.warn("⚠️ Errore durante la pulizia ScrollTrigger:", err);
  }

  // Attesa colorThemes
  if (!window.colorThemes || typeof window.colorThemes.getTheme !== "function") {
    if (retryCount < 20) {
      gsap.delayedCall(0.1, () => initNavbarTheme(namespace, retryCount + 1));
    }
    return;
  }

  const config = navbarThemeTriggers[namespace];
  if (!config) {
    gsap.to(".nav_component", { ...colorThemes.getTheme("light"), duration: 0.6, ease: "power2.out" });
    return;
  }

  // Imposta tema iniziale dark
  gsap.set(".nav_component", { ...colorThemes.getTheme(config.startTheme) });

  // Delay per aspettare il layout stabile (hero render + immagini)
  gsap.delayedCall(0.6, () => {
    const triggerEl = document.querySelector(config.trigger);
    if (!triggerEl) {
      console.warn("⚠️ Trigger hero non trovato:", config.trigger);
      return;
    }

    // Crea il nuovo ScrollTrigger
    ScrollTrigger.create({
      id: "navbar-theme",
      trigger: triggerEl,
      start: "bottom top",
      end: "bottom+=1 top",
      onEnter: () => {
        gsap.to(".nav_component", { ...colorThemes.getTheme("light"), duration: 0.5, ease: "power3.out" });
      },
      onLeaveBack: () => {
        gsap.to(".nav_component", { ...colorThemes.getTheme(config.startTheme), duration: 0.5, ease: "power3.out" });
      },
      markers: false
    });

    // Rinfresca calcoli di posizione dopo creazione
    gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
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
 * FORM SUCCESS → MODAL-BASED BARBA TRANSITION
 ***********************/
// Nuova funzione: initFormSuccessTransition con supporto per transizioni custom
function initFormSuccessTransition() {
  const forms = document.querySelectorAll("form");

  forms.forEach((form) => {
    form.addEventListener("submit", function (e) {
      // Intercetta solo se Webflow ha completato correttamente l'invio
      $(document).one("ajaxComplete", function () {
        // Evita doppi trigger
        $(document).off("ajaxComplete");

        // Disabilita temporaneamente l'evento per evitare loop dopo la transizione
        window.__formJustSubmitted = true;

        // Determina il tipo di transizione da usare
        const formName = form.getAttribute("name") || "";
        let transitionId = "#transition-default";
        if (formName.includes("Contatti") || formName.includes("Eventi") || formName.includes("Matrimoni")) {
          transitionId = "#transition-contact";
        }

        const overlay = document.querySelector(transitionId);
        if (!overlay) return;

        // Blocca il loop: se siamo già sulla home, non richiamiamo barba.go("/")
        const currentUrl = window.location.pathname.replace(/\/$/, "");
        if (currentUrl !== "/") {
          window.__barbaTransitionTarget = transitionId;
          try {
            barba.go("/");
          } catch (e) {
            console.warn("Barba go failed:", e);
          }
        }

        // Dopo la prima esecuzione, resetta il flag
        setTimeout(() => {
          window.__formJustSubmitted = false;
        }, 3000);
      });
    });
  });
}

// E nel tuo hook barba, prima di ogni transizione:
barba.hooks.before(() => {
  // Se la transizione è appena stata causata da un form, non rilanciarla
  if (window.__formJustSubmitted) {
    $(document).off("ajaxComplete");
  }
});



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



function initHeroSingleExperience(scope = document) {
  const section = scope.querySelector('#section-hero');
  if (!section) return null;

  console.log("✅ initHeroSingleExperience triggered");

  // Elementi principali
  const eyebrowWraps = section.querySelectorAll('#eyebrow-wrap .eyebrow_wrap');
  const heading   = section.querySelector('.c-heading');
  const paragraph = section.querySelector('#paragraph-group');
  const visual      = section.querySelector('.visual_border_wrap');

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
function initHeroWedding(scope = document) {
if (!scope.querySelector('#hero-matrimoni')) return null;
  return null;
}
function initHeroPrivateEvent(scope = document) {
  if (!scope.querySelector('#hero-private-event')) return null;
  return null;
}
function initHeroRestaurant(scope = document) {
  if (!scope.querySelector('#hero-restaurant')) return null;
  return null;
}
function initHeroExperience(scope = document) {
  if (!scope.querySelector('#hero-experience')) return null;
  return null;
}


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
  // if (letters.length) {
  //   tl.to(letters, { yPercent: 0, duration: 0.7, ease: easeLetters, stagger: 0.15, autoForce3D: true }, "<0.2");
  // }

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
      { rotation: 380, duration: 1.5, ease: "spinStar", transformOrigin: "center center", autoForce3D: true },
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
      // timeout: 8000,

        // ONCE — sposta su
once: async ({ next }) => {
  const scope = next?.container || document;

  // 1) Lenis prima di tutto (e poi lo stoppi per il loader)
  initLenis();
  try { window.lenis?.stop(); } catch {}

  // 2) Ora è sicuro creare i trigger
  initMenu();
  initSectionReveal(scope);
  initGlobalParallax(scope);
  initGlobalSlider(scope);
  initAnimateThemeScroll(scope);
  initCurrentYear(scope);
  initSignature();
  initCustomCursor();
  preventSamePageClicks();
  initFormSuccessTransition();

  if (next?.container?.dataset?.barbaNamespace === "matrimoni") {
    initSliderReview(next.container);
  }
  // In once
  gsap.delayedCall(0.3, () => {
    initNavbarTheme(next.container.dataset.barbaNamespace);
  });

  updateCurrentNav(next?.container?.dataset?.barbaNamespace);

  // 3) Prepara hero ma in pausa
  const ns = next?.container?.getAttribute('data-barba-namespace') || 'home';
  const heroTl = buildHeroForNamespace(ns, scope);
  if (heroTl) heroTl.pause(0);

  const loaderDone = initLoader({
    onBeforeHide: () => {
      gsap.delayedCall(0.3, () => heroTl?.play(0));
    }
  });

  await loaderDone;

  // 4) Refresh dopo hero/loader
  refreshScrollTrigger(0.3);
},

      /* Uscita pagina corrente */
      leave(data) {
        // Decidi quale wrapper usare per la transizione: custom o default
        let wrap = null;
        if (window.__barbaTransitionTarget) {
          wrap = document.querySelector(window.__barbaTransitionTarget);
        }
        if (!wrap) {
          wrap = document.querySelector(".transition_wrap");
        }
        const sealEl = wrap?.querySelector(".transition_seal");
        const titleEl = wrap?.querySelector(".transition_title");
        const textEl = wrap?.querySelector(".transition_text");
        const starTopEl = wrap?.querySelector("#spinstartop");
        let nextLabel = getNextLabel(data);

        // Se la transizione non è quella di default, forziamo il titolo "Grazie"
        if (window.__barbaTransitionTarget && window.__barbaTransitionTarget !== ".transition_wrap") {
          nextLabel = "Grazie";
        }

        if (titleEl) titleEl.textContent = nextLabel || "";

        return gsap.timeline({ defaults: { ease: "loader", duration: 1 } })
          .set(wrap, { display: "block", visibility: "visible", yPercent: 100 })
          .to(data.current.container, { y: "-15vh" }, "<")
          .to(wrap, { yPercent: 0 }, "<")
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
              { rotation: 380, duration: 1.5, ease: 'spinStar', transformOrigin: 'center center', autoForce3D: true },
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
        let wrap = null;
        if (window.__barbaTransitionTarget) {
          wrap = document.querySelector(window.__barbaTransitionTarget);
        }
        if (!wrap) {
          wrap = document.querySelector(".transition_wrap");
        }
        const starBottomEl = wrap?.querySelector("#spinstarbottom");

        //forceNextPageToTop();

        const tl = gsap.timeline({ defaults: { ease: "loader", duration: 1.2 } })
      
          .add(() => {
              if (starBottomEl) gsap.set(starBottomEl, { rotation: 0 });
            }, 0)
            .fromTo(
                starBottomEl,
                { rotation: 0 },
                { rotation: 360, duration: 1.3, ease: 'spinStar', transformOrigin: 'center center', autoForce3D: true },
            )
          .from(data.next.container, { y: "15vh", delay: 0.1 },"<0.2")
          
          .to(wrap, { yPercent: -100 }, "<")
          .set(wrap, { yPercent: 100, display: "none", visibility: "hidden" });

        // sovrapponi la hero del namespace in ingresso solo se esiste
        try {
          const ns = getNextNamespace(data);
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
      },
    },
    {
      namespace: "eventi",
      afterEnter({ next }) {
        const scope = next?.container || document;
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
  ]
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

/* Hook ogni volta che entri in una nuova pagina */
barba.hooks.beforeEnter((data) => {
  const scope = data?.next?.container || document;

  initAutoPlayVideos(scope);
  initLenis();

  resetThemeToLight();

  initSectionReveal(scope);
  initGlobalParallax(scope);
  initGlobalSlider(scope);
  initAnimateThemeScroll(scope);

  forceNextPageToTop();

  

  // Aggiorna la navbar corrente in base al namespace della prossima pagina
  const nextNs = data?.next?.container?.dataset?.barbaNamespace;
  if (nextNs) updateCurrentNav(nextNs);
});

/* Hook eventuali integrazioni post-swap */
barba.hooks.after((data) => {
  if (typeof resetWebflow === "function") resetWebflow(data);
  const scope = data?.next?.container || document;
  initCurrentYear(scope);
});

barba.hooks.afterEnter((data) => {
  gsap.delayedCall(0.5, () => {
    initNavbarTheme(data.next.container.dataset.barbaNamespace);
    initHideNavbarOnScroll(60); // threshold personalizzato
  });
  // Inizializza la mappatura form->transizione custom dopo ogni enter
  initFormSuccessTransition();
});