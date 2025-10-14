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

  const explicit = doc?.querySelector("[data-page-title]")?.textContent?.trim();
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
 * SLIDER GLOBALE
 ***********************/
function initGlobalSlider(scope = document) {
  const components = scope.querySelectorAll(
    "[data-slider='component']:not([data-slider='component'] [data-slider='component'])"
  );
  if (!components.length) return;

  const removeCMSList = (slot) => {
    const dynList = Array.from(slot.children).find((c) => c.classList?.contains("w-dyn-list"));
    if (!dynList) return;
    const nestedItems = dynList?.firstElementChild?.children;
    if (!nestedItems) return;
    const staticWrapper = [...slot.children];
    [...nestedItems].forEach((el) => slot.appendChild(el));
    staticWrapper.forEach((el) => el.remove());
  };

  components.forEach((component) => {
    if (component.dataset.scriptInitialized === "true") return;
    component.dataset.scriptInitialized = "true";

    const swiperEl = component.querySelector(".slider_element");
    const swiperWrapper = component.querySelector(".slider_list");
    if (!swiperEl || !swiperWrapper) return;

    
    removeCMSList(swiperWrapper);

    
    [...swiperWrapper.children].forEach((el) => el.classList.add("swiper-slide"));

    
    const followFinger = swiperEl.getAttribute("data-follow-finger") === "true",
          freeMode = swiperEl.getAttribute("data-free-mode") === "true",
          mousewheel = swiperEl.getAttribute("data-mousewheel") === "true",
          slideToClickedSlide = swiperEl.getAttribute("data-slide-to-clicked") === "true",
          loop = swiperEl.getAttribute("data-slider-loop") === "true",
          centeredSlides = swiperEl.getAttribute("data-centered-slides") === "true",
          speed = +(swiperEl.getAttribute("data-speed") || 600);

    
    const swiper = new Swiper(swiperEl, {
      slidesPerView: "auto",
      followFinger: followFinger,
      loop: loop,
      loopAdditionalSlides: 10,
      freeMode: freeMode,
      slideToClickedSlide: slideToClickedSlide,
      centeredSlides: centeredSlides,
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
        nextEl: component.querySelector("[data-slider='next']"),
        prevEl: component.querySelector("[data-slider='previous']"),
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

  scope.__swiperCleanup = () => {
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
 * HERO — FUNZIONI SPECIFICHE
 ***********************/

// HERO HOME
function initHeroHome(scope = document) {
  const section = scope.querySelector('#hero-home');
  if (!section) return null;

  const bg      = section.querySelector('.u-background-skeleton');
  const heading = section.querySelector('.c-heading');
  const para    = section.querySelector('.c-paragraph');
  const btns    = section.querySelector('.u-button-group');

  if (bg)      gsap.set(bg,      { scale: 1.08 });
  if (heading) gsap.set(heading, { autoAlpha: 0, yPercent: 20, filter: 'blur(5px)' });
  if (para)    gsap.set(para,    { autoAlpha: 0, yPercent: 20, filter: 'blur(5px)' });
  if (btns)    gsap.set(btns,    { autoAlpha: 0, yPercent: 20, filter: 'blur(5px)' });

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (bg) {
    tl.to(bg, { autoAlpha: 1, duration: 0.8 }, 0)
      .to(bg, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0);
  }
  if (heading) tl.to(heading, { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.8 }, 0.2);
  if (para)    tl.to(para,    { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.7 }, '<0.1');
  if (btns)    tl.to(btns,    { autoAlpha: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.6 }, '<0.2');

  return tl;
}

// HERO VILLA
function initHeroVilla(scope = document) {
  const section   = scope.querySelector('#hero-villa');
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

/* Stubs NON mappati (solo log, nessuna TL) */
function initHeroWedding(scope = document) {
  if (!scope.querySelector('#hero-wedding')) return null;
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
function initHeroSingleExperience(scope = document) {
  if (!scope.querySelector('#hero-single-experience')) return null;
  return null;
}
function initHeroContact(scope = document) {
  if (!scope.querySelector('#hero-contact')) return null;
  return null;
}

/***********************
 * HERO REGISTRY + BUILDER
 ***********************/
const HERO_BUILDERS = {
  home:  initHeroHome,
  villa: initHeroVilla,
  // wedding: initHeroWedding,
  // 'private-event': initHeroPrivateEvent,
  // restaurant: initHeroRestaurant,
  // experience: initHeroExperience,
  // 'single-experience': initHeroSingleExperience,
  // contact: initHeroContact,
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
    selArrow     = ".loader_logo_arrow",
    easeLetters = "power2.out",
    easeArrow   = "power2.out",
    easeText    = "power3.out",
    easeOut     = "power3.inOut",
    onReady = null,
    onBeforeHide = null
  } = opts;

  if (initLoader._running) return initLoader._running;

  const wrap = document.querySelector(".loader_wrap");
  if (!wrap) return Promise.resolve();

  // prevent flicker
  wrap.classList.remove("is-hidden");
  wrap.setAttribute("aria-hidden", "false");
  gsap.set(wrap, { display: "block", opacity: 1, clearProps: "y" });

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
  const logoTexts = wrap.querySelectorAll(selLogo);
  const texts     = wrap.querySelectorAll(selText);
  const arrow     = wrap.querySelector(selArrow);

  // Initial state
  if (logoTexts.length) gsap.set(logoTexts, { autoAlpha: 0, willChange: "opacity, transform" });
  if (texts.length)     gsap.set(texts,     { autoAlpha: 0, willChange: "opacity, transform" });
  if (letters.length)   gsap.set(letters,   { yPercent: 110, willChange: "transform" });
  if (arrow)            gsap.set(arrow,     { scaleX: 0, transformOrigin: "left", willChange: "transform" });

  // Unlock prevent flicker
  const flickerEls = wrap.querySelectorAll("[data-prevent-flicker='true']");
  if (flickerEls.length) gsap.set(flickerEls, { visibility: "visible" });

  const startTime = performance.now();

  // Timeline loader
  const tl = gsap.timeline({ defaults: { force3D: true }, paused: true });

  if (letters.length) {
    tl.to(letters, { yPercent: 0, duration: 0.7, ease: easeLetters, stagger: 0.15 }, 0);
  }
  if (arrow) {
    tl.to(arrow, { scaleX: 1, duration: 2, ease: easeArrow }, "<0.1");
  }
  if (logoTexts.length) {
    tl.to(logoTexts, { autoAlpha: 1, duration: 1.0, ease: easeText }, "<");
  }
  if (texts.length) {
    tl.to(texts, { autoAlpha: 1, duration: 1.0 }, "<0.5");
  }

  if (typeof onBeforeHide === "function") {
    tl.add(onBeforeHide, "+=0.1");
  }


  tl.to(wrap, { y: "-100%", duration: 1.0, ease: easeOut }, "+=0.1");

  tl.add(() => {
    gsap.set(wrap, { clearProps: "y" });
    wrap.classList.add("is-hidden");
    wrap.setAttribute("aria-hidden", "true");
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

  // 1) Lenis prima di tutto (e poi lo stoppi per il loader)
  initLenis();
  try { window.lenis?.stop(); } catch {}

  // 2) Ora è sicuro creare i trigger
  initSectionReveal(scope);
  initGlobalParallax(scope);
  initGlobalSlider(scope);
  initAnimateThemeScroll(scope);
  initCurrentYear(scope);
  initSignature();
  initCustomCursor();
  preventSamePageClicks();
  initSimpleFormSuccess(scope);

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
      
          const wrap = document.querySelector(".transition_wrap");
          const titleEl = wrap?.querySelector(".transition_title");
          const nextLabel = getNextLabel(data);

          if (titleEl) titleEl.textContent = nextLabel || "";

          return gsap.timeline({ defaults: { ease: "power3.inOut", duration: 1 } })
            .set(wrap, { display: "block", visibility: "visible", yPercent: 100 })
            .to(data.current.container, { y: "-15vh" })
            .to(wrap, { yPercent: 0 }, "<")
        
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
        const wrap = document.querySelector(".transition_wrap");

        //forceNextPageToTop();

        const tl = gsap.timeline({ defaults: { ease: "power3.inOut", duration: 1 } })
          .from(data.next.container, { y: "15vh", delay: 0.15 })
          .to(wrap, { yPercent: -100 }, "<")
          .set(wrap, { yPercent: 100, display: "none", visibility: "hidden" });

        // sovrapponi la hero del namespace in ingresso solo se esiste
        try {
          const ns = getNextNamespace(data);
          const heroTl = buildHeroForNamespace(ns, data.next.container);
          if (heroTl) {
            tl.add(heroTl, "-=0.35");
          }
        } catch {}

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
      namespace: "wedding",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "private-event",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "restaurant",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "experience",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "single-experience",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
    {
      namespace: "contact",
      afterEnter({ next }) {
        const scope = next?.container || document;
      },
    },
  ]
});

/* Hook ogni volta che entri in una nuova pagina */
barba.hooks.beforeEnter(({ next }) => {
  const scope = next?.container || document;

  initAutoPlayVideos(scope);
  initLenis();

  resetThemeToLight();

  initSectionReveal(scope);
  initGlobalParallax(scope);
  initGlobalSlider(scope);
  initAnimateThemeScroll(scope);
  // initSimpleFormSuccess(scope); // Spostato in afterEnter

  forceNextPageToTop();
});

/* Hook eventuali integrazioni post-swap */
barba.hooks.after((data) => {
  if (typeof resetWebflow === "function") resetWebflow(data);
  const scope = data?.next?.container || document;
  initCurrentYear(scope);
});

barba.hooks.afterEnter(({ next }) => {
  const scope = next?.container || document;
  initSimpleFormSuccess(scope);
});

/***********************
 * FORM SUCCESS — gestito con Webflow + Barba
 ***********************/
function initSimpleFormSuccess(scope = document) {
  // Seleziona solo i form all’interno dello scope (utile per Barba)
  const $forms = $(scope).find(".w-form form");

  $forms.each(function () {
    const $form = $(this);

    // Evita doppi binding
    if ($form.data("bound-success")) return;
    $form.data("bound-success", true);

    // Intercetta evento submit
    $form.on("submit", function () {
      // ⏱️ Timeout per attendere il success di Webflow
      setTimeout(() => {
        const $success = $form.closest(".w-form").find(".w-form-done");
        if ($success.length) {
          // 🔹 Nasconde il messaggio di successo standard
          $success.hide();

          // 🔹 Avvia transizione Barba SOLO se la sezione di successo esiste
          console.log("✅ Form inviato con successo → barba.go()");
          if (window.barba) barba.go("/");
        }
      }, 1200); // tempo di sicurezza
    });
  });
}

/** Reinizializza Webflow dopo transizioni Barba */
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

    // Ripristina classi w--current
    document.querySelectorAll(".w--current").forEach(el => el.classList.remove("w--current"));
    document.querySelectorAll("a").forEach(link => {
      if (link.getAttribute("href") === window.location.pathname) {
        link.classList.add("w--current");
      }
    });

    console.log("🔁 Webflow reset completato");
  } catch (err) {
    console.warn("⚠️ Errore nella reinizializzazione di Webflow:", err);
  }
}