// UNAL Market — 3D Cards (Aceternity-UI style), dependency-free vanilla port.
// CardContainer/CardBody/CardItem behavior: perspective tilt on hover,
// layered items floating at different translateZ depths, springy reset.
// Vanilla CSS 3D transforms + rAF spring — no React, no framer-motion.
(() => {
  "use strict";

  const spring = { stiffness: 150, damping: 20, mass: 0.1 }; // framer-motion defaults used by the original
  const PERSPECTIVE = 1000;

  const createState = () => ({ rx: 0, ry: 0, vrx: 0, vry: 0, tx: 0, ty: 0 });

  const bindCard = (container) => {
    const body = container.querySelector(".card-3d-body");
    if (!body || container.dataset.card3dBound) return !!container;
    container.dataset.card3dBound = "1";

    // Perspective lives on the container (like CardContainer).
    container.style.perspective = PERSPECTIVE + "px";
    container.style.transformStyle = "preserve-3d";
    body.style.transformStyle = "preserve-3d";
    body.style.willChange = "transform";

    const items = [...body.querySelectorAll("[data-translate-z]")];
    for (const item of items) {
      const z = parseFloat(item.dataset.translateZ) || 0;
      item.style.transform = "translateZ(" + z + "px)";
      item.style.transformStyle = "preserve-3d";
      item.style.transition = "transform 150ms ease-out";
    }

    const s = createState();
    let raf = 0;
    let lastT = performance.now();

    // Stable critically-damped smoothing (spring-like, no blow-up).
    const SMOOTH = 14;
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      const k = 1 - Math.exp(-dt * SMOOTH);
      s.rx += (s.tx - s.rx) * k;
      s.ry += (s.ty - s.ry) * k;
      body.style.transform =
        "rotateX(" + s.rx.toFixed(3) + "deg) rotateY(" + s.ry.toFixed(3) + "deg)";
      if (Math.abs(s.rx - s.tx) > 0.02 || Math.abs(s.ry - s.ty) > 0.02) {
        raf = requestAnimationFrame(tick);
      } else {
        s.rx = s.tx;
        s.ry = s.ty;
        body.style.transform =
          "rotateX(" + s.tx.toFixed(3) + "deg) rotateY(" + s.ty.toFixed(3) + "deg)";
        raf = 0;
      }
    };
    const kick = () => {
      if (!raf) {
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const onMove = (e) => {
      const rect = container.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      s.tx = -py * 10; // rotateX range ±5deg (as the original component)
      s.ty = px * 10;
      const gx = ((px + 0.5) * 100).toFixed(1);
      const gy = ((py + 0.5) * 100).toFixed(1);
      body.style.setProperty("--gx", gx + "%");
      body.style.setProperty("--gy", gy + "%");
      kick();
    };
    const onLeave = () => {
      s.tx = 0;
      s.ty = 0;
      kick();
    };

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    return true;
  };

  const boot = () => {
    const bind = () => {
      const cards = document.querySelectorAll("[data-card-3d]");
      cards.forEach(bindCard);
      return document.querySelectorAll("[data-card-3d][data-card-3d-bound]").length;
    };
    if (bind() >= 2) return;
    const began = performance.now();
    const poll = setInterval(() => {
      const n = bind();
      if (n >= 2 || performance.now() - began > 15000) clearInterval(poll);
    }, 150);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
