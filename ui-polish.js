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
    // live dot next to "ouvert · menu disponible"
    document.querySelectorAll("div").forEach((el) => {
      if (!/ouvert\s*·\s*menu disponible/i.test(el.textContent) || el.children.length > 3) return;
      const dot = el.querySelector("span, i, div");
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

  /* ---------- boot ---------- */
  function runOnce() {
    mountTicker();
    addBorderBeams();
    addShine();
    initReveals();
    pulseDots();
  }

  // The SPA re-renders route content; run at boot and again shortly after.
  runOnce();
  const t1 = setTimeout(runOnce, 800);
  const t2 = setTimeout(runOnce, 2000);
  window.addEventListener("popstate", () => setTimeout(runOnce, 150));
})();
