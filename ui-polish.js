/* UNAL Market — additive UI polish layer (vanilla, zero dependencies).
   Inspired by Magic UI patterns: BorderBeam, Marquee, Shine Effect,
   Animated status dots, and IntersectionObserver scroll reveals.
   Nothing here rewrites existing markup — it decorates it. */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- 1. Marquee ticker under the nav ---------- */
  function mountTicker() {
    const anchor = document.querySelector("nav") || document.querySelector("main > header");
    if (!anchor || anchor.nextElementSibling && anchor.nextElementSibling.classList.contains("unal-ticker")) return;

    // Les horaires du ruban sont STATIQUES ici : l'horaire réel (et le fait
    // d'être ouvert ou fermé) est calculé par `open-status.js`, qui réécrit ce
    // segment toutes les 2 s. Avant, ce fichier imprimait l'heure locale de la
    // machine (« OUVERT 19h · FERME 19H » à 19h passées) : faux et non accentué.
    const items = [
      "SANDWICHS DÈS 3,50 €",
      "BURGERS MAISON",
      "PÂTES & TACOS",
      "HORAIRES · 10H – 19H",
      "SUR PLACE OU À EMPORTER",
      "UNAL MARKET · ARMENTIÈRES",
    ];

    const bar = document.createElement("div");
    bar.className = "unal-ticker";
    bar.setAttribute("aria-hidden", "true");
    const track = document.createElement("div");
    track.className = "unal-ticker-track";
    // content duplicated once → translateX(-50%) loops seamlessly
    for (let r = 0; r < 2; r++) {
      items.forEach((t) => {
        const s = document.createElement("span");
        s.textContent = t + "   ✦   ";
        track.appendChild(s);
      });
    }
    bar.appendChild(track);

    if (anchor.parentElement) anchor.parentElement.insertBefore(bar, anchor.nextSibling);
  }

  /* ---------- 2. Border beam on the two liquid-glass cards ---------- */
  function addBorderBeams() {
    document.querySelectorAll(".card-3d-body").forEach((body) => {
      if (body.querySelector(":scope > .border-beam")) return;
      const beam = document.createElement("div");
      beam.className = "border-beam";
      beam.setAttribute("aria-hidden", "true");
      // second card gets a phase offset so the two beams are not synchronized
      beam.style.animationDelay = body.parentElement.nextElementSibling ? "-2.75s" : "0s";
      body.appendChild(beam);
    });
  }

  /* ---------- 3. Shine sweep on primary CTA buttons ---------- */
  function addShine() {
    document.querySelectorAll("a, button").forEach((el) => {
      const t = (el.textContent || "").toUpperCase();
      const isPrimary =
        /VOIR (LA CARTE|LE MENU)/.test(t) ||
        (t.trim() === "SUR PLACE" && el.tagName === "A") ||
        (t.includes("SUR PLACE") && el.className.includes("bg-red"));
      if (!isPrimary || el.classList.contains("btn-shine")) return;
      // skip the nav CTA (too small) and keep it to solid-filled buttons
      const cs = getComputedStyle(el);
      if (cs.backgroundColor === "rgba(0, 0, 0, 0)") return;
      el.classList.add("btn-shine");
      if (el.tagName === "A" || el.tagName === "BUTTON") el.classList.add("unal-glass-btn");
    });
  }

  /* ---------- 4. Scroll reveals ---------- */
  function initReveals() {
    const targets = new Set();
    const collect = (sel) =>
      document.querySelectorAll(sel).forEach((el) => targets.add(el));
    collect("section.border-y .frosted-blur");   // info strip cards
    collect("section.border-t .frosted-blur");   // hours cards
    collect("main section > div > h2, main section > div > p"); // landing headings
    collect("main h2.mt-5");                     // /menu category titles
    if (!targets.size) return;

    targets.forEach((el) => {
      if (!el.classList.contains("reveal")) el.classList.add("reveal");
    });

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("in");
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ---------- 5. Pulsing status dots ---------- */
  function pulseDots() {
    if (reduceMotion.matches) return;
    // live dot next to "ouvert · menu disponible". The dot must be a small,
    // solid-colored span (same precision as the hours cards below). A loose
    // match once stamped .dot-live on the big hero wrapper; its ::after
    // overlay then covered the sparkle title and swallowed :hover.
    // Le libellé est réécrit en direct par `open-status.js` (« ouvert · ferme à
    // 19h00 » / « fermé · ouvre lundi à 10h00 ») : on matche donc le début du
    // texte plutôt qu'une phrase figée, sinon le point perdait sa classe.
    document.querySelectorAll("div").forEach((el) => {
      if (!/^\s*(ouvert|fermé)\s*·/i.test(el.textContent) || el.children.length > 3) return;
      const dot = [...el.querySelectorAll("span, i, div")].find((c) => {
        const cs = getComputedStyle(c);
        return (
          c.offsetWidth <= 14 &&
          c.offsetWidth === c.offsetHeight &&
          cs.backgroundColor !== "rgba(0, 0, 0, 0)"
        );
      });
      if (dot && !dot.classList.contains("dot-live")) dot.classList.add("dot-live");
    });
    // green open-dots in the hours cards
    document.querySelectorAll("section.border-t .frosted-blur").forEach((card) => {
      if (/fermé/i.test(card.textContent)) return;
      const dot = [...card.querySelectorAll("span")].find((s) => {
        const c = getComputedStyle(s).backgroundColor;
        return s.offsetWidth <= 14 && s.offsetWidth === s.offsetHeight && c !== "rgba(0, 0, 0, 0)";
      });
      if (dot && !dot.classList.contains("dot-live")) dot.classList.add("dot-live");
    });
  }

  /* ---------- 6. Chrome-metal finish on ALL main & secondary titles ----------
     Adds .chrome-title (font + animated polished-chrome gradient, see
     index.html) to every real title of every page: landing, /menu and
     /informations-legales. Skips the sparkling hero title (its own UI is
     kept intact) and all small mono kickers/pills. Accent spans inside a
     title (e.g. "simplement.") render the same chrome — see index.html.
     Each title gets a negative animation-delay so the sheens drift out of
     sync instead of pulsing in a lockstep wave. */
  function applyChromeTitles() {
    document
      .querySelectorAll(
        "h1:not([data-chrome-done]), h2:not([data-chrome-done]), " +
        "h3:not([data-chrome-done]), h4:not([data-chrome-done]), " +
        "h5:not([data-chrome-done]), h6:not([data-chrome-done]), " +
        ".card-3d-body > span.font-display:not([data-chrome-done])"
      )
      .forEach((el) => {
        if (el.closest(".sparkle-button")) return;      // hero title untouched
        if (el.classList.contains("font-mono")) return;  // mono kickers/pills stay as-is
        if ((el.textContent || "").length > 80) return;  // titles, not paragraphs
        el.classList.add("chrome-title");
        el.style.animationDelay = `${-(document.querySelectorAll(".chrome-title").length - 1) * 1.3}s`;
        el.setAttribute("data-chrome-done", "");
      });
  }

  /* ---------- 7. Cibles tactiles : on agrandit la ZONE SANS toucher au dessin ---
     Certains contrôles sont plus petits que 44×44 px (bouton rond d'en-tête,
     pastille « Confidentialité », lien légal du pied de page). On ajoute un
     pseudo-élément transparent qui déborde de 8 px : la cible tactile grandit,
     le rendu reste identique au pixel près. On n'utilise ::after que s'il est
     libre, sinon ::before, sinon on ne touche à rien. */
  const TAP_CSS =
    ".unal-tap { position: relative; }" +
    ".unal-tap::after, .unal-tap-before::before { content: \"\"; position: absolute; inset: -8px -6px; }";

  function expandTapTargets() {
    if (!document.getElementById("unal-tap-style")) {
      const style = document.createElement("style");
      style.id = "unal-tap-style";
      style.textContent = TAP_CSS;
      document.head.appendChild(style);
    }
    document.querySelectorAll("a, button, [role='button']").forEach((el) => {
      if (el.classList.contains("unal-tap")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;           // caché : on repassera
      if (r.height >= 44 && r.width >= 44) return;       // déjà confortable
      const after = getComputedStyle(el, "::after").content;
      const before = getComputedStyle(el, "::before").content;
      const free = after === "none" ? "after" : before === "none" ? "before" : null;
      if (!free) return;                                  // déjà décoré : on n'y touche pas
      el.classList.add("unal-tap");
      if (free === "before") el.classList.add("unal-tap-before");
    });
  }

  /* ---------- 8. Nom accessible des boutons icône ---------------------------
     L'en-tête mobile n'affiche qu'un bouton rond (flèche) : sans libellé, un
     lecteur d'écran annonce juste « bouton ». On nomme les contrôles icône qui
     n'ont ni texte ni aria-label. Le CSS `md:hidden` de la barre n'est pas
     touché : on ne fait qu'ajouter le nom. */
  const ICON_NAMES = [
    { sel: "nav button[data-size='icon']", label: "Voir le menu" },
  ];

  function nameIconControls() {
    ICON_NAMES.forEach(({ sel, label }) => {
      document.querySelectorAll(sel).forEach((el) => {
        if ((el.textContent || "").trim()) return;   // a déjà un libellé visible
        if (el.getAttribute("aria-label")) return;
        el.setAttribute("aria-label", label);
      });
    });
  }

  /* ---------- boot ---------- */
  function runOnce() {
    mountTicker();
    addBorderBeams();
    addShine();
    initReveals();
    pulseDots();
    applyChromeTitles();
    expandTapTargets();
    nameIconControls();
  }

  // The SPA re-renders route content; run at boot and again shortly after.
  runOnce();
  const t1 = setTimeout(runOnce, 800);
  const t2 = setTimeout(runOnce, 2000);
  window.addEventListener("popstate", () => setTimeout(runOnce, 150));

  // Client-side navigation (pushState) fires no event we can hook: watch the
  // DOM instead. Debounced; the [data-chrome-done] guards make re-runs cheap.
  let moTimer = 0;
  const mo = new MutationObserver(() => {
    clearTimeout(moTimer);
    moTimer = setTimeout(runOnce, 120);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
