// UNAL Market — Hero Carousel background (filmstrip hero), faithful vanilla port.
//
// Port EXACT du composant fourni (HeroCarousel) : mêmes ratios mesurés
// (CARD_H .264, CARD_AR .75, GAP .038, STRIP_TOP .5, TITLE .067, LABEL .0103,
// PAD .017, RAIL .2), mêmes seuils molette (60 / 420 ms), même grain SVG
// auto-porté, mêmes mécaniques — fond = photo focalisée agrandie puis
// re-teintée par l'accent (mix-blend color + multiply), liseré haut/bas,
// wash de lisibilité, rail de position 01/08, strip à bord haut partagé où
// la carte focalisée se déplie (pleine hauteur, 3:4) et les voisines restent
// à moitié, molette/trackpad, drag horizontal avec vélocité, clavier,
// pause au survol.
//
// Adaptations demandées (fond de site, pas héros de page) :
// - monté en fond fixe (.site-background, visible sur TOUTES les pages) ;
// - autoplay : l'image change toute seule toutes les 5 s (pause au survol,
//   pendant un drag, et si prefers-reduced-motion) ;
// - les 8 items utilisent les photos locales du magasin ;
// - accents neutres (chrome/gris) conformes à la palette chrome & noir.
//
// Zéro dépendance (motion/react → rAF + transitions CSS pilotées en JS).
// Chargé avec `defer` depuis index.html.
(() => {
  "use strict";

  // ---- items (mêmes champs que le composant : title, image, credit, meta, accent)
  const ITEMS = [
    { title: "Comptoir\n& saveurs", image: "/img/unal-01-interieur-comptoir.jpg", credit: "UNAL MARKET.", meta: ["SUR PLACE", "À EMPORTER"], accent: "#9aa3ad" },
    { title: "Nos\nrayons", image: "/img/unal-02-rayons.jpg", credit: "UNAL MARKET.", meta: ["ÉPICERIE", "FRAIS"], accent: "#a8adb4" },
    { title: "La façade", image: "/img/unal-03-facade-angle.jpg", credit: "UNAL MARKET.", meta: ["ARMENTIÈRES"], accent: "#8f98a1" },
    { title: "Devance\nla boutique", image: "/img/unal-04-facade-large.jpg", credit: "UNAL MARKET.", meta: ["CENTRE-VILLE"], accent: "#a2a9b0" },
    { title: "La\nterrasse", image: "/img/unal-05-facade-terrasse.jpg", credit: "UNAL MARKET.", meta: ["BEAU TEMPS"], accent: "#979ea6" },
    { title: "Les\nétals", image: "/img/unal-06-etals.jpg", credit: "UNAL MARKET.", meta: ["DU JOUR"], accent: "#a6abb1" },
    { title: "L'épicerie\nfine", image: "/img/unal-07-epicerie.jpg", credit: "UNAL MARKET.", meta: ["CAVE", "ÉPICERIE"], accent: "#929aa3" },
    { title: "Le\ncommerce", image: "/img/unal-08-commerce.jpg", credit: "UNAL MARKET.", meta: ["DEPUIS 2024"], accent: "#9ba1a8" },
  ];

  const AUTOPLAY_DELAY = 5000; // consigne : changement toutes les 5 s

  /* Ratios du composant, relatifs à la scène. */
  const CARD_H = 0.264;
  const CARD_AR = 0.75;
  const GAP = 0.038;
  const STRIP_TOP = 0.5;
  const TITLE = 0.067;
  const LABEL = 0.0103;
  const PAD = 0.017;
  const RAIL = 0.2;

  const WHEEL_THRESHOLD = 60;
  const WHEEL_COOLDOWN = 420;

  const GRAIN =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function injectStyle() {
    if (document.getElementById("unal-carousel-style")) return;
    const style = document.createElement("style");
    style.id = "unal-carousel-style";
    style.textContent = `
.unal-carousel {
  position: absolute; inset: 0; overflow: hidden;
  background: #000; color: #fff; user-select: none; -webkit-user-select: none;
  outline: none;
  /* EN FOND DE SITE : jamais de capture d'événements — la molette, les clics
     et le tactile doivent traverser vers le contenu (sinon le carrousel fixed
     piège le scroll et empêche les boutons de se cliquer). */
  pointer-events: none;
}

/* Les overlays typographiques du composant entrent en collision avec
   l'en-tête, le ticker et les titres du site — masqués en fin de feuille
   (spécificité + !important) pour battre les règles display:flex ci-dessous. */
.unal-carousel, .unal-carousel * { box-sizing: border-box; }
.unal-carousel, .unal-carousel * { box-sizing: border-box; }

/* fond : photo focalisée agrandie + re-teinte accent (mix-blend color/multiply) */
.unal-cb { position: absolute; inset: 0; opacity: 0; transition: opacity .7s ease-out; }
.unal-cb.on { opacity: 1; }
.unal-cb img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
  transform: scale(1.42); transition: transform 6s linear;
}
.unal-cb.on img { transform: scale(1.28); }
.unal-cb .tint-mult { position: absolute; inset: 0; opacity: .30; mix-blend-mode: multiply; }

/* liseré haut/bas + grain, au-dessus du fondu pour ne jamais scintiller */
.unal-cw { position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,.4), transparent, rgba(0,0,0,.45)); }
.unal-grain { position: absolute; inset: 0; opacity: .22; mix-blend-mode: overlay;
  background-image: var(--unal-grain); background-size: 180px 180px; pointer-events: none; }

/* barre du haut : cluster centré */
.unal-ctop { position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; }
.unal-ctop .brand { font-weight: 600; letter-spacing: .06em; opacity: .95; }

/* bloc titre, juste au-dessus du bord haut du strip */
.unal-chead { position: absolute; left: 0; right: 0; top: 0; display: flex; flex-direction: column; justify-content: flex-end; }
.unal-chrow { display: flex; width: 100%; flex-wrap: wrap; align-items: flex-end; column-gap: 6vw; row-gap: 8px; }
.unal-ch2 { font-weight: 600; line-height: .88; letter-spacing: -.03em; margin: 0; }
.unal-ch2 .ln { display: block; overflow: hidden; }
.unal-ch2 .ln > span { display: block; transform: translateY(110%); transition: transform .62s cubic-bezier(.22,1,.36,1); }
.unal-cb.on ~ * .unal-ch2 .ln > span, .unal-carousel .ln > span.in { transform: translateY(0); }
.unal-credit { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: .14em; opacity: .8; }
.unal-meta { margin-left: auto; display: flex; align-items: flex-end; }
.unal-meta span { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: .14em; white-space: nowrap; opacity: .8; }

/* strip : bord haut partagé, carte focalisée deux fois plus haute */
.unal-cstrip { position: absolute; left: 0; right: 0; }
.unal-ctrack { display: flex; align-items: flex-start; touch-action: pan-y; will-change: transform; }
.unal-ctrack.dragging { cursor: default; }
.unal-ccard { position: relative; flex-shrink: 0; overflow: hidden; border-radius: 0; background: rgba(255,255,255,.05);
  border: 0; padding: 0; -webkit-appearance: none; appearance: none; }
.unal-ccard img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.unal-ccard .shade { position: absolute; inset: 0; background: #000; opacity: .12; transition: opacity .7s cubic-bezier(.16,1,.3,1); pointer-events: none; }
.unal-ccard.active .shade { opacity: 0; }

/* rail de position */
.unal-crail { position: absolute; }
.unal-crail-nums { display: flex; justify-content: space-between; font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; opacity: .8; }
.unal-crail-bar { position: relative; margin-top: 8px; height: 1px; width: 100%; background: rgba(255,255,255,.25); }
.unal-crail-fill { position: absolute; top: 0; bottom: 0; background: #fff; transition: left .7s cubic-bezier(.16,1,.3,1); }

@media (prefers-reduced-motion: reduce) {
  .unal-cb img { transition: none; transform: scale(1.28); }
  .unal-ch2 .ln > span { transition: none; transform: none; }
}

.unal-carousel .unal-ctop,
.unal-carousel .unal-chead,
.unal-carousel .unal-crail { display: none !important; }

/* Les gros anneaux décoratifs du bundle (/affichage), prévus pour une page
   sombre, passent mal par-dessus les photos du carrousel — quasi invisibles. */
.unal-hero-ring { border-color: rgba(255, 255, 255, 0.035) !important; }
`;
    document.head.appendChild(style);
  }

  function mount(stage) {
    stage.classList.add("unal-carousel");
    stage.style.setProperty("--unal-grain", GRAIN);
    stage.tabIndex = 0;
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-roledescription", "carousel");
    stage.setAttribute("aria-label", "Featured looks");

    stage.innerHTML =
      '<div class="unal-cback"></div>' +
      '<div class="unal-cw"></div>' +
      '<div class="unal-grain"></div>' +
      '<div class="unal-ctop"></div>' +
      '<div class="unal-chead"><div class="unal-chrow">' +
      '<h2 class="unal-ch2"></h2>' +
      '<p class="unal-credit"></p>' +
      '<div class="unal-meta"></div>' +
      "</div></div>" +
      '<div class="unal-cstrip"><div class="unal-ctrack"></div></div>' +
      '<div class="unal-crail"><div class="unal-crail-nums"><span class="n1">01</span><span class="n2">' +
      String(ITEMS.length).padStart(2, "0") +
      '</span></div><div class="unal-crail-bar"><div class="unal-crail-fill"></div></div></div>';

    const back = stage.querySelector(".unal-cback");
    const topBar = stage.querySelector(".unal-ctop");
    const head = stage.querySelector(".unal-chead");
    const h2 = stage.querySelector(".unal-ch2");
    const creditEl = stage.querySelector(".unal-credit");
    const metaEl = stage.querySelector(".unal-meta");
    const strip = stage.querySelector(".unal-cstrip");
    const track = stage.querySelector(".unal-ctrack");
    const rail = stage.querySelector(".unal-crail");
    const railFill = stage.querySelector(".unal-crail-fill");
    const railNum = stage.querySelector(".unal-crail-nums .n1");

    // marque "UNAL MARKET" centré (brand)
    const brand = document.createElement("div");
    brand.className = "brand";
    brand.textContent = "UNAL MARKET";
    topBar.appendChild(brand);

    // cartes du strip
    const cards = ITEMS.map((item, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "unal-ccard";
      b.setAttribute("aria-label", item.title.replace(/\n/g, " "));
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = "";
      img.draggable = false;
      img.style.objectPosition = "50% 26%"; // ancrage du composant
      const shade = document.createElement("span");
      shade.className = "shade";
      shade.setAttribute("aria-hidden", "true");
      b.appendChild(img);
      b.appendChild(shade);
      b.addEventListener("click", () => go(i));
      track.appendChild(b);
      return b;
    });

    // fond : un calque par image (cross-fade, comme AnimatePresence)
    const backs = ITEMS.map((item) => {
      const d = document.createElement("div");
      d.className = "unal-cb";
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = "";
      img.draggable = false;
      const tc = document.createElement("div");
      // Photos en COULEURS (consigne) : pas de calque mix-blend "color" (il
      // re-teintait la photo, donc grayscale avec un accent neutre). On garde
      // seulement un multiply léger pour la lisibilité.
      tc.style.display = "none";
      const tm = document.createElement("div");
      tm.className = "tint-mult";
      tm.style.backgroundColor = item.accent;
      d.appendChild(img);
      d.appendChild(tc);
      d.appendChild(tm);
      back.appendChild(d);
      return d;
    });

    // ---- mesures (un ResizeObserver alimente tout) ----------------------------
    const box = { w: 0, h: 0 };
    let fullH = 0, halfH = 0, cardW = 0, gap = 0, step = 0, pad = 0, label = 0;

    const read = () => {
      box.w = stage.clientWidth || 1;
      box.h = stage.clientHeight || 1;
      fullH = clamp(box.h * CARD_H, 96, 360);
      halfH = fullH / 2;
      cardW = fullH * CARD_AR;
      gap = Math.max(4, Math.round(cardW * GAP));
      step = cardW + gap;
      pad = Math.max(16, Math.round(box.w * PAD));
      label = Math.max(9, Math.round(box.h * LABEL));

      strip.style.top = STRIP_TOP * 100 + "%";
      strip.style.height = fullH + "px";
      head.style.height = STRIP_TOP * 100 + "%";
      head.style.paddingLeft = pad + "px";
      head.style.paddingRight = pad + "px";
      head.style.paddingBottom = Math.round(box.h * 0.028) + "px";
      topBar.style.top = Math.max(16, box.h * 0.029) + "px";
      topBar.style.gap = Math.max(20, box.w * 0.06) + "px";
      brand.style.fontSize = label * 1.35 + "px";
      h2.style.fontSize = Math.max(24, Math.round(box.h * TITLE)) + "px";
      creditEl.style.fontSize = label + "px";
      metaEl.style.gap = Math.max(16, box.w * 0.055) + "px";
      [...metaEl.children].forEach((s) => (s.style.fontSize = label + "px"));
      rail.style.left = pad + "px";
      rail.style.bottom = Math.max(14, box.h * 0.022) + "px";
      rail.style.width = box.w * RAIL + "px";
      rail.style.fontSize = label + "px";
      layout();
    };
    const ro = new ResizeObserver(read);
    ro.observe(stage);

    const xFor = (i) => box.w / 2 - (i * step + cardW / 2);

    // ---- état --------------------------------------------------------------------
    let index = 0;
    let x = 0;          // position courante du track
    let xTarget = 0;    // cible (spring)
    let vx = 0;
    let dragging = false;
    let paused = false;
    let raf = 0;

    const SPRING = { stiffness: 260, damping: 34, mass: 0.9 };

    const layout = () => {
      cards.forEach((c, i) => {
        c.style.width = cardW + "px";
        c.style.height = (i === index ? fullH : halfH) + "px";
        c.classList.toggle("active", i === index);
        c.setAttribute("aria-current", i === index ? "true" : "false");
      });
    };

    const renderHead = () => {
      const active = ITEMS[index];
      h2.innerHTML = "";
      active.title.split("\n").forEach((line, i) => {
        const ln = document.createElement("span");
        ln.className = "ln";
        const s = document.createElement("span");
        s.textContent = line;
        ln.appendChild(s);
        h2.appendChild(ln);
        setTimeout(() => s.classList.add("in"), 30 + i * 70);
      });
      creditEl.textContent = active.credit || "";
      metaEl.innerHTML = "";
      (active.meta || []).forEach((fact) => {
        const sp = document.createElement("span");
        sp.textContent = fact;
        metaEl.appendChild(sp);
        sp.style.fontSize = label + "px";
      });
      railNum.textContent = String(index + 1).padStart(2, "0");
      railFill.style.width = 100 / ITEMS.length + "%";
      railFill.style.left = (index / ITEMS.length) * 100 + "%";
    };

    const applyIndex = () => {
      backs.forEach((d, i) => d.classList.toggle("on", i === index));
      layout();
      renderHead();
      xTarget = xFor(index);
    };

    const go = (next) => {
      const c = clamp(next, 0, ITEMS.length - 1);
      if (c !== index) {
        index = c;
        applyIndex();
      }
    };

    // ---- molette / trackpad (deux axes, verrou + cooldown du composant) ----------
    let acc = 0;
    let until = 0;
    const onWheel = (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const stuck = (delta > 0 && index === ITEMS.length - 1) || (delta < 0 && index === 0);
      if (stuck) { acc = 0; return; }
      e.preventDefault();
      const now = e.timeStamp;
      if (now < until) return;
      acc += delta;
      if (Math.abs(acc) < WHEEL_THRESHOLD) return;
      go(index + Math.sign(acc));
      acc = 0;
      until = now + WHEEL_COOLDOWN;
    };
    stage.addEventListener("wheel", onWheel, { passive: false });

    // ---- drag horizontal avec vélocité (drag="x", momentum off) ------------------
    let dragStartX = 0;
    let dragBaseX = 0;
    let lastMoveT = 0;
    let throwV = 0;
    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      track.classList.add("dragging");
      dragStartX = e.clientX;
      dragBaseX = x;
      lastMoveT = performance.now();
      throwV = 0;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      throwV = 0.65 * throwV + 0.35 * ((e.clientX - (dragStartX + dragBaseX - x)) / dt) * 1000;
      x = dragBaseX + (e.clientX - dragStartX);
      lastMoveT = now;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("dragging");
      // atterrit sur la carte la plus proche, nudge vélocité (info.velocity.x * .12)
      const thrown = x + throwV * 0.12;
      go(Math.round((box.w / 2 - thrown - cardW / 2) / step));
    };
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);

    // clavier (ArrowLeft/Right/Home/End)
    stage.addEventListener("keydown", (e) => {
      const keys = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: ITEMS.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      go(keys[e.key]);
    });

    // pause au survol / focus (autoplay seulement)    // NOTE : stage est pointer-events:none (fond) — ces événements ne se
    // déclenchent plus, l'autoplay tourne donc en continu (consigne : 5 s).

    // ---- autoplay 5 s (consigne) ---------------------------------------------------
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setInterval(() => {
      if (!reduced && !paused && !dragging && ITEMS.length > 1) {
        go(index === ITEMS.length - 1 ? 0 : index + 1);
      }
    }, AUTOPLAY_DELAY);

    // ---- spring track (stiffness 260, damping 34) -----------------------------------
    const springStep = (dt) => {
      const F = SPRING;
      // semi-implicite stable : a = -k(x - xt) - c·v (masses normalisées)
      const k = F.stiffness / F.mass;
      const c = F.damping / F.mass;
      const ax = -k * (x - xTarget) - c * vx;
      vx += ax * dt;
      x += vx * dt;
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - (frame.t || now)) / 1000, 0.1);
      frame.t = now;
      if (!dragging) springStep(dt);
      track.style.transform = "translate3d(" + x + "px,0,0)";
    };
    raf = requestAnimationFrame(frame);

  // ---- boot -------------------------------------------------------------------------
  read();
  applyIndex();
  x = xTarget; // démarrage centré sans glisser


  }

  // ---- le contenu laisse voir le fond (main transparent sur toutes les pages) ------
  function keepMainTransparent() {
    const main = document.querySelector("main");
    if (main && !main.classList.contains("unal-bg-transparent")) {
      main.classList.add("unal-bg-transparent");
    }
  }

  // ---- monté en FOND : recréé si le shell React recrée .site-background -------------
  let active = null;

  // adoucir les anneaux décoratifs du bundle (montés après coup par React) —
  // relancé depuis la boucle ensure() qui tourne déjà toutes les 600 ms.
  function softenRings() {
    try {
      document
        .querySelectorAll('div[class*="rounded-full"][class*="border-"]')
        .forEach((el) => {
          if (el.querySelector("*") || el.textContent.trim()) return;
          if (
            !el.classList.contains("unal-hero-ring") &&
            parseInt(getComputedStyle(el).borderTopWidth) >= 40
          ) {
            el.classList.add("unal-hero-ring");
          }
        });
    } catch (e) {
      /* cosmétique */
    }
  }

  function ensure() {
    keepMainTransparent();
    softenRings();
    const bg = document.querySelector(".site-background");
    if (!bg) return;
    let stage = bg.querySelector(":scope > .unal-carousel");
    if (stage) return; // déjà en place
    if (active && active.isConnected) active.remove();
    stage = document.createElement("div");
    bg.insertBefore(stage, bg.firstChild);
    injectStyle();
    mount(stage);
    active = stage;
  }

  function boot() {
    injectStyle();
    const began = performance.now();
    const poll = setInterval(() => {
      const bg = document.querySelector(".site-background");
      if (bg) {
        clearInterval(poll);
        ensure();
        // surveillance SPA : le shell peut recréer le fond
        setInterval(ensure, 600);
        window.addEventListener("popstate", () => setTimeout(ensure, 300));
      } else if (performance.now() - began > 15000) {
        clearInterval(poll);
        console.warn("[unal-carousel] .site-background never appeared");
      }
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
