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

    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const hour = now.getHours();
    const open = day !== 0 && hour >= 10 && hour < 19;
    const clock = String(hour).padStart(2, "0") + "h";
    const items = [
      "SANDWICHS DÈS 3,50 €",
      "BURGERS MAISON",
      "PÂTES & TACOS",
      "OUVERT " + clock + " · FERME 19H",
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
    document.querySelectorAll("div").forEach((el) => {
      if (!/ouvert\s*·\s*menu disponible/i.test(el.textContent) || el.children.length > 3) return;
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
     index.html) to every real title of every page: landing, /menu, /affichage
     and /informations-legales. Skips the sparkling hero title (its own UI is
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

  /* ---------- boot ---------- */
  function runOnce() {
    mountTicker();
    addBorderBeams();
    addShine();
    initReveals();
    pulseDots();
    applyChromeTitles();
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
