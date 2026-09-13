// UNAL Market — hero title: "Crystal Glow" (Originkit SparkleButton), vanilla port.
//
// Faithful, unmodified port of the user-provided Originkit component: same
// .sparkle-button CSS (6-step diagonal shadow, gradient glare clipped to the
// text, 5 sparkle SVGs with staggered hover animation), same custom-property
// mechanics (--hover / --pos / --font-size), same rest(0.4)/hover(1)/tap(0)
// states, same SVG path. framer-motion is replaced by CSS transitions on the
// custom properties (the component already declares its own transitions).
//
// Only the *configuration* differs (per the user: keep the current title):
// text = "UNAL MARKET ·\nARMENTIÈRES" (line breaks via <br>), font-size
// clamped to the hero box, white text, amber #F57F17 shadow, white glare.
//
// Zero dependencies. Loaded with `defer` from index.html. Re-binds after SPA
// route changes (same pattern as ui-polish.js / phone-3d.js).
(() => {
  "use strict";

  // ---- configuration (site values; effect behavior is untouched) ----------
  const CONFIG = {
    lines: ["UNAL MARKET ·", "ARMENTIÈRES"],
    fontWeight: 800, // preset "Extra Bold"
    fontFamily: "Inter, 'Archivo', system-ui, sans-serif",
    fontSize: "clamp(2.6rem, 11vw, 9rem)",
    letterSpacing: "0.04em", // preset
    lineHeight: 1, // preset "1em"
    textColor: "#FFFFFF",
    shadowColor: "#F57F17", // component default (amber)
    glareColor: "rgba(255, 255, 255, 0.75)", // component default
    glareSpeed: 1,
    glareDirection: "left-to-right",
  };

  // ---- exact SVG path from the component -----------------------------------
  const SPARKLE_PATH =
    "M93.781 51.578C95 50.969 96 49.359 96 48c0-1.375-1-2.969-2.219-3.578 " +
    "0 0-22.868-1.514-31.781-10.422-8.915-8.91-10.438-31.781-10.438-31.781 " +
    "C50.969 1 49.375 0 48 0s-2.969 1-3.594 2.219c0 0-1.5 22.87-10.406 " +
    "31.781-8.908 8.913-31.781 10.422-31.781 10.422C1 45.031 0 46.625 0 48c0 " +
    "1.359 1 2.969 2.219 3.578 0 0 22.873 1.51 31.781 10.422 8.906 8.911 " +
    "10.406 31.781 10.406 31.781C45.031 95 46.625 96 48 96s2.969-1 " +
    "3.562-2.219c0 0 1.523-22.871 10.438-31.781 8.913-8.908 31.781-10.422 " +
    "31.781-10.422Z";

  // ---- exact stylesheet from the component ----------------------------------
  function injectStyle() {
    if (document.getElementById("sparkle-button-style")) return;
    // Register the animated custom properties: without @property, CSS cannot
    // interpolate them and --hover/--pos would snap (framer-motion animated
    // them per-frame in JS). Registered = same smooth spring/linear motion.
    const props = document.createElement("style");
    props.id = "sparkle-button-style";
    props.innerHTML = `
@property --hover { syntax: "<number>"; inherits: true; initial-value: 0.4; }
@property --pos { syntax: "<number>"; inherits: true; initial-value: 0; }
    `;
    document.head.appendChild(props);
    const style = document.createElement("style");
    style.id = "sparkle-button-style-rules";
    style.innerHTML = `
.sparkle-button {
  --padding: 24px 32px;
  padding: var(--padding);
  border-radius: 16px;
  text-decoration: none;
  color: transparent;
  position: relative;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* framer-motion "rest" variant values, as plain CSS (raised 0.4 -> 0.55
     for the deeper relief the owner asked for) */
  --hover: 0.55;
  --pos: 0;
  transition: --hover 0.55s cubic-bezier(0.32, 0, 0.67, 0), --pos 0s;
}
.sparkle-button:hover {
  /* framer-motion "hover" variant: --pos animates linearly over 1/glareSpeed */
  --hover: 1;
  --pos: 1;
  transition: --hover 0.55s cubic-bezier(0.32, 0, 0.67, 0), --pos 1s linear;
}
.sparkle-button:active {
  --hover: 0; /* framer-motion "tap" variant */
}

.sparkle-button span {
  display: inline-block;
  font-size: var(--font-size);
  font-weight: ${CONFIG.fontWeight};
  text-decoration: none;
  color: transparent;
  /* Deeper relief: 9 extrusion steps (component had 5), up to 0.16em */
  text-shadow:
    calc(var(--hover) * (var(--font-size) * -0)) calc(var(--hover) * (var(--font-size) * 0)) var(--shadow),
    calc(var(--hover) * (var(--font-size) * -0.02)) calc(var(--hover) * (var(--font-size) * 0.02)) var(--shadow),
    calc(var(--hover) * (var(--font-size) * -0.04)) calc(var(--hover) * (var(--font-size) * 0.04)) var(--shadow),
    calc(var(--hover) * (var(--font-size) * -0.06)) calc(var(--hover) * (var(--font-size) * 0.06)) var(--shadow),
    calc(var(--hover) * (var(--font-size) * -0.08)) calc(var(--hover) * (var(--font-size) * 0.08)) var(--shadow),
    calc(var(--hover) * (var(--font-size) * -0.10)) calc(var(--hover) * (var(--font-size) * 0.10)) var(--shadow),
    calc(var(--hover) * (var(--font-size) * -0.12)) calc(var(--hover) * (var(--font-size) * 0.12)) var(--shadow),
    calc(var(--hover) * (var(--font-size) * -0.14)) calc(var(--hover) * (var(--font-size) * 0.14)) var(--shadow),
    calc(var(--hover) * (var(--font-size) * -0.16)) calc(var(--hover) * (var(--font-size) * 0.16)) var(--shadow);
  transform: translate(calc(var(--hover) * (var(--font-size) * 0.10)), calc(var(--hover) * (var(--font-size) * -0.10)));
}

.sparkle-button span:last-of-type {
  position: absolute;
  inset: 0;
  padding: var(--padding);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    108deg,
    transparent 0 55%,
    var(--glare) 55% 60%,
    transparent 60% 70%,
    var(--glare) 70% 85%,
    transparent 85%
  ) calc(var(--pos) * -200%) 0% / 200% 100%, var(--color);
  -webkit-background-clip: text;
  color: transparent;
  z-index: 2;
  text-shadow: none;
  /* soft lift under the glyphs, scaling with --hover for real depth */
  filter: drop-shadow(0 calc(var(--hover) * 8px) calc(var(--hover) * 16px) rgba(2, 8, 22, 0.5));
}

.sparkle-button svg {
  position: absolute;
  z-index: 3;
  width: calc(var(--font-size) * 0.68);
  aspect-ratio: 1;
  pointer-events: none;
  top: calc(var(--y, 50) * 1%);
  left: calc(var(--x, 0) * 1%);
  transform: translate(-50%, -50%) scale(0);
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.9));
}

.sparkle-button svg path {
  fill: var(--glare);
}

/* Stars keep popping in and out (desynchronized periods) the whole time the
   cursor stays on the title; negative delays start them mid-burst. */
.sparkle-button:hover svg {
  animation: star-pop calc(1.5s + (var(--d) * 0.22s)) calc(var(--d) * -0.35s) infinite;
}

@keyframes star-pop {
  0% { transform: translate(-50%, -50%) scale(0); }
  15% { transform: translate(-50%, -50%) scale(var(--s, 1)); }
  50% { transform: translate(-50%, -50%) scale(calc(var(--s, 1) * 0.7)); }
  80% { transform: translate(-50%, -50%) scale(var(--s, 1)); }
  100% { transform: translate(-50%, -50%) scale(0); }
}

.sparkle-button svg:nth-of-type(1) { --x: 0; --y: 20; --s: 1.2; --d: 1; --delay-step: 0.15; }
.sparkle-button svg:nth-of-type(2) { --x: 15; --y: 80; --s: 1.5; --d: 2; --delay-step: 0.15; }
.sparkle-button svg:nth-of-type(3) { --x: 45; --y: 40; --s: 1.3; --d: 3; --delay-step: 0.15; }
.sparkle-button svg:nth-of-type(4) { --x: 75; --y: 60; --s: 1.0; --d: 2; --delay-step: 0.15; }
.sparkle-button svg:nth-of-type(5) { --x: 100; --y: 30; --s: 1.1; --d: 4; --delay-step: 0.15; }
.sparkle-button svg:nth-of-type(6) { --x: 30; --y: 12; --s: 1.4; --d: 2; --delay-step: 0.15; }
.sparkle-button svg:nth-of-type(7) { --x: 62; --y: 88; --s: 1.2; --d: 3; --delay-step: 0.15; }
.sparkle-button svg:nth-of-type(8) { --x: 90; --y: 72; --s: 1.5; --d: 1; --delay-step: 0.15; }
.sparkle-button svg:nth-of-type(9) { --x: 8; --y: 55; --s: 1.0; --d: 4; --delay-step: 0.15; }
    `;
    document.head.appendChild(style);
  }

  // ---- text fit (same rationale as the canvas rasterizer the site had):
  // shrink the rendered text to never overflow the hero box.
  // styleTarget owns --font-size; measureInner is the button; outer is the box.
  function fitTitle(styleTarget, fontSizeEl, measureInner, outer, clampSize) {
    let basePx = null;
    const fit = () => {
      const current = parseFloat(getComputedStyle(fontSizeEl).fontSize);
      if (basePx === null || styleTarget.style.getPropertyValue("--font-size") === clampSize) basePx = current;
      const predictedAtBase = measureInner.scrollWidth * (basePx / current);
      const over = predictedAtBase / outer.clientWidth;
      if (over > 1.01) {
        styleTarget.style.setProperty("--font-size", `${Math.floor((basePx / over) * 100) / 100}px`);
        requestAnimationFrame(fit); // re-measure once at the fitted size
      } else {
        styleTarget.style.setProperty("--font-size", clampSize);
      }
    };
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(outer);
    if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => { });
  }

  // ---- mount -----------------------------------------------------------------
  function mount(host) {
    if (host.dataset.crystalGlowBound) return;
    host.dataset.crystalGlowBound = "1";

    // This effect replaces the old WebGL hero title: clear its canvas and the
    // role="img" shell so the real text below is exposed to assistive tech.
    host.querySelectorAll("canvas").forEach((c) => c.remove());
    host.removeAttribute("role");
    host.removeAttribute("aria-label");

    injectStyle();

    const {
      lines, fontFamily, fontSize, letterSpacing, lineHeight,
      textColor, shadowColor, glareColor, glareDirection,
    } = CONFIG;

    // The component's outer flex wrapper (width/height 100%)
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });

    const btn = document.createElement("a");
    btn.className = "sparkle-button";
    // keep heading semantics (the old canvas was the page's h1); no href:
    // the title must not navigate, it only reacts to hover like the component
    btn.setAttribute("role", "heading");
    btn.setAttribute("aria-level", "1");
    btn.setAttribute("aria-label", lines.join(" "));
    // natural (max-content) width — as a flex item it would otherwise be
    // squeezed to the host width, wrapping the text and breaking fitTitle
    btn.style.setProperty("flex", "none");
    const s = btn.style;
    s.setProperty("font-family", fontFamily);
    s.setProperty("--color", textColor);
    s.setProperty("--shadow", shadowColor);
    s.setProperty("--glare", glareColor);
    s.setProperty("--font-size", fontSize);
    // em-based text metrics go on the spans: em resolves at the element's own
    // font-size (the button keeps --font-size but no font-size of its own)
    const applyTextMetrics = (span) => {
      span.style.setProperty("letter-spacing", letterSpacing);
      span.style.setProperty("line-height", String(lineHeight));
    };

    // 9 Sparkle SVGs (exact path) — 4 added around the component's 5
    for (let i = 0; i < 9; i++) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 96 96");
      svg.setAttribute("fill", "none");
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", SPARKLE_PATH);
      svg.appendChild(path);
      btn.appendChild(svg);
    }

    // The two text spans (visible shadow layer + glare-clipped layer)
    const text = lines.join("\n");
    for (let i = 0; i < 2; i++) {
      const span = document.createElement("span");
      lines.forEach((line, li) => {
        if (li > 0) span.appendChild(document.createElement("br"));
        span.appendChild(document.createTextNode(line));
      });
      if (i === 1) span.setAttribute("aria-hidden", "true");
      applyTextMetrics(span);
      btn.appendChild(span);
    }

    // right-to-left direction support (component prop)
    if (glareDirection === "right-to-left") {
      btn.style.setProperty("--pos", "1");
      btn.addEventListener("mouseenter", () => btn.style.setProperty("--pos", "0"));
      btn.addEventListener("mouseleave", () => btn.style.setProperty("--pos", "1"));
    }

    wrap.appendChild(btn);
    host.appendChild(wrap);

    // Fit the text inside the hero box (same rationale as before);
    // fontSizeEl = first span (it carries font-size: var(--font-size))
    fitTitle(btn, btn.querySelector("span"), btn, host, fontSize);
  }

  function bind() {
    document
      .querySelectorAll(".warp-text:not([data-crystal-glow-bound])")
      .forEach(mount);
  }

  bind();
  setInterval(bind, 1500);
  window.addEventListener("popstate", () => setTimeout(bind, 150));
})();
