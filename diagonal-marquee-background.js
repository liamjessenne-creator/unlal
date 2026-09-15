// UNAL Market — Diagonal Marquee Carousel background (port vanilla du composant
// « DiagonalMarqueeCarousel », Great UI / MIT).
//
// Le code du composant est repris fidèlement :
// - carte : 400×300, rounded-xl, overflow hidden, shadow-2xl, image object-cover
//   + voile bg-black/40 ;
// - rangée : conteneur flex overflow-hidden, piste en flex-shrink-0 portant
//   DEUX copies identiques des cartes, chaque carte dans un wrapper `pr-8` ;
// - animations : `marquee-left` (0 → -50%) et `marquee-right` (-50% → 0),
//   durées pilotées par la variable CSS `--speed` (comme `style={{ "--speed" }}`) ;
// - 5 rangées, angle -25°, baseSpeed 120, alternateDirections = true :
//   120 (-1), 105 (+1), 135 (-1), 114 (+1), 144 (-1)
//   (les vitesses base-15 / base-6 sont bien bornées à 30 / 35) ;
// - rangées impaires : cartes inversées (`rowCardsReverse`) ;
// - fondus haut/bas de 25 % (ici sur le noir du site plutôt que `from-white`) ;
// - piste diagonale : `w-[200vw]`, empilée en colonne avec `gap-8`, rotate(angle).
//
// Adaptations explicitement liées au site (le composant est ici un DÉCOR, pas une
// section) : les images sont tes 8 photos locales, le tout est monté dans
// `.site-background` en `pointer-events: none` (donc la pause au survol du
// composant est neutralisée : elle piégerait les clics de la page), et un voile
// sombre léger garde les titres chrome lisibles par-dessus.
(() => {
  "use strict";

  const CARDS = [
    { id: 1, url: "/img/unal-01-interieur-comptoir.jpg", title: "Rayons & épicerie" },
    { id: 2, url: "/img/unal-02-rayons.jpg", title: "Comptoir à sandwichs" },
    { id: 3, url: "/img/unal-03-facade-angle.jpg", title: "Pains & vitrine" },
    { id: 4, url: "/img/unal-04-facade-large.jpg", title: "Snacks & douceurs" },
    { id: 5, url: "/img/unal-05-facade-terrasse.jpg", title: "Espace sur place" },
    { id: 6, url: "/img/unal-06-etals.jpg", title: "Les allées" },
    { id: 7, url: "/img/unal-07-epicerie.jpg", title: "L'angle place Thiers" },
    { id: 8, url: "/img/unal-08-commerce.jpg", title: "La devanture" },
  ];

  const ANGLE = -25;          // angle du composant
  const BASE_SPEED = 120;     // baseSpeed
  const ALTERNATE = true;     // alternateDirections
  const ROW_SPEEDS = [
    BASE_SPEED,
    BASE_SPEED - 15 > 20 ? BASE_SPEED - 15 : 30,
    BASE_SPEED + 15,
    BASE_SPEED - 6 > 20 ? BASE_SPEED - 6 : 35,
    BASE_SPEED + 24,
  ];

  function injectStyle() {
    if (document.getElementById("unal-dmc-style")) return;
    const style = document.createElement("style");
    style.id = "unal-dmc-style";
    style.textContent = `
@keyframes unal-dmc-left  { 0% { transform: translate3d(0,0,0); }   100% { transform: translate3d(-50%,0,0); } }
@keyframes unal-dmc-right { 0% { transform: translate3d(-50%,0,0); } 100% { transform: translate3d(0,0,0); } }

.unal-dmc {
  position: absolute; inset: 0; overflow: hidden; background: #05060a;
  /* DÉCOR : aucun événement capturé (sinon le fond piège les clics et la molette) */
  pointer-events: none;
  display: flex; align-items: center; justify-content: center;
}
/* piste diagonale : w-200vw, empilée en colonne (gap-8), rotate(angle).
   Centrage explicite (top/left 50 % + translate) pour que la rotation soit
   parfaitement centrée quelle que soit la taille du bloc. */
.unal-dmc-rot {
  position: absolute; z-index: 0; display: flex; flex-direction: column;
  top: 50%; left: 50%; width: 200vw; gap: 2rem;
  transform: translate(-50%, -50%) rotate(${ANGLE}deg);
  /* Pas de will-change ici : ce parent est ÉNORME (200vw) et ne bouge pas.
     Le promouvoir forçait le navigateur à rasteriser tout le bloc en une seule
     texture (plafonnée en mémoire), donc des photos moins nettes sur les écrans
     HiDPI. La promotion reste sur les pistes, qui elles bougent. */
}
.unal-dmc-row { display: flex; width: 100%; overflow: hidden; }
.unal-dmc-track {
  display: flex; flex-shrink: 0; will-change: transform;
  animation: unal-dmc-left var(--speed) linear infinite;
  backface-visibility: hidden;
}
/* décor hors écran ou onglet en arrière-plan : on met la piste en pause
   (même rendu, mais on ne consomme plus de GPU pour rien) */
.unal-dmc.is-paused .unal-dmc-track { animation-play-state: paused; }
.unal-dmc-track.right { animation-name: unal-dmc-right; }
.unal-dmc-set { display: flex; flex-shrink: 0; }
.unal-dmc-cell { flex-shrink: 0; padding-right: 2rem; }
.unal-dmc-card {
  position: relative; height: 300px; width: 400px; flex-shrink: 0;
  overflow: hidden; border-radius: 0.75rem; background: #0b0d12;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06);
}
.unal-dmc-card img {
  height: 100%; width: 100%; object-fit: cover; display: block;
  /* la source est utilisée à sa résolution native (500→811 px pour des cartes
     de 400×300) : rien n'est agrandi, on ne fait que relever le rendu perçu */
  filter: saturate(1.06) contrast(1.03);
}
/* voile du composant (bg-black/40) : allégé, il écrasait la luminosité des
   photos — le montage reste un décor, mais il se voit vraiment maintenant */
.unal-dmc-veil { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.16); }
/* fondus haut / bas : réduits à 16 % (25 % mangeaient une bonne partie du
   cadre) et moins opaques — juste de quoi asseoir l'en-tête et le pied de page */
.unal-dmc-fade { position: absolute; left: 0; right: 0; height: 16%; z-index: 10; pointer-events: none; }
.unal-dmc-fade.top { top: 0; background: linear-gradient(to bottom, rgba(5, 6, 10, 0.92), rgba(5, 6, 10, 0)); }
.unal-dmc-fade.bottom { bottom: 0; background: linear-gradient(to top, rgba(5, 6, 10, 0.92), rgba(5, 6, 10, 0)); }
/* voile de lisibilité du site (titres chrome / textes) : léger au centre
   pour que les photos restent lisibles, plus dense en haut et en bas. */
.unal-dmc-wash {
  position: absolute; inset: 0; z-index: 11; pointer-events: none;
  /* deux couches :
     1. un dégradé latéral doux — la colonne de texte du héro (à gauche sur
        grand écran) reste parfaitement lisible, la droite reste lumineuse ;
     2. le dégradé vertical haut/bas, léger au centre. */
  background:
    linear-gradient(90deg,
      rgba(4, 6, 10, 0.40) 0%,
      rgba(4, 6, 10, 0.18) 34%,
      rgba(4, 6, 10, 0.00) 64%),
    linear-gradient(180deg,
      rgba(4, 6, 10, 0.34) 0%,
      rgba(4, 6, 10, 0.07) 26%,
      rgba(4, 6, 10, 0.05) 52%,
      rgba(4, 6, 10, 0.18) 76%,
      rgba(4, 6, 10, 0.44) 100%);
}
/* le contenu de page reste transparent (le fond React l'est déjà, on le
   verrouille ici pour que la piste reste visible après chaque navigation) */
.app-route-content,
.app-route-content > main { background-color: transparent; }

@media (max-width: 640px) {
  .unal-dmc-card { height: 210px; width: 280px; }
  .unal-dmc-cell { padding-right: 1rem; }
  .unal-dmc-rot { gap: 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  .unal-dmc-track { animation: none; }
}
`;
    document.head.appendChild(style);
  }

  function cardNode(card) {
    const wrap = document.createElement("div");
    wrap.className = "unal-dmc-cell";
    const box = document.createElement("div");
    box.className = "unal-dmc-card";
    const img = document.createElement("img");
    img.src = card.url;
    img.alt = card.title;
    img.decoding = "async";
    img.loading = "eager";
    img.draggable = false;
    const veil = document.createElement("div");
    veil.className = "unal-dmc-veil";
    box.appendChild(img);
    box.appendChild(veil);
    wrap.appendChild(box);
    return wrap;
  }

  function rowNode(cards, speed, direction) {
    const row = document.createElement("div");
    row.className = "unal-dmc-row";
    const track = document.createElement("div");
    track.className = "unal-dmc-track" + (direction === 1 ? " right" : "");
    track.style.setProperty("--speed", speed + "s");
    // deux copies identiques → boucle parfaite sur translate -50%
    for (let copy = 0; copy < 2; copy++) {
      const set = document.createElement("div");
      set.className = "unal-dmc-set";
      cards.forEach((c) => set.appendChild(cardNode(c)));
      track.appendChild(set);
    }
    row.appendChild(track);
    return row;
  }

  function mount(host) {
    host.classList.add("unal-dmc");
    // rowCards = 3 × les cartes ; les rangées alternées utilisent la version inversée
    const rowCards = CARDS.concat(CARDS, CARDS);
    const rowCardsReverse = rowCards.slice().reverse();

    const rot = document.createElement("div");
    rot.className = "unal-dmc-rot";
    ROW_SPEEDS.forEach((speed, i) => {
      const reverse = ALTERNATE ? i % 2 === 1 : false;
      const dir = reverse ? 1 : -1;
      rot.appendChild(rowNode(reverse ? rowCardsReverse : rowCards, speed, dir));
    });
    host.appendChild(rot);

    const fadeTop = document.createElement("div");
    fadeTop.className = "unal-dmc-fade top";
    const fadeBottom = document.createElement("div");
    fadeBottom.className = "unal-dmc-fade bottom";
    const wash = document.createElement("div");
    wash.className = "unal-dmc-wash";
    host.appendChild(fadeTop);
    host.appendChild(fadeBottom);
    host.appendChild(wash);
  }

  // Pause du fond dès qu'il sort de l'écran, ou dès que l'onglet est caché :
  // le décor est lourd (5 pistes animées), inutile de payer pour lui hors champ.
  let watcher = null;
  let hiddenBound = false;
  function watch(host) {
    if (!watcher && typeof IntersectionObserver !== "undefined") {
      watcher = new IntersectionObserver((records) => {
        for (const record of records) {
          record.target.dataset.offScreen = record.isIntersecting ? "0" : "1";
          record.target.classList.toggle(
            "is-paused",
            !record.isIntersecting || document.hidden
          );
        }
      }, { rootMargin: "120px" });
    }
    watcher?.observe(host);
    if (!hiddenBound) {
      hiddenBound = true;
      document.addEventListener("visibilitychange", () => {
        document.querySelectorAll(".unal-dmc").forEach((el) => {
          el.classList.toggle(
            "is-paused",
            document.hidden || el.dataset.offScreen === "1"
          );
        });
      });
    }
  }

  // Le shell applique `opacity: .92` au fond : les photos perdent 8 % de
  // luminosité sans raison. On remet 1, en respectant le mode « mouvement
  // réduit » du site (qui baisse volontairement cette opacité).
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function applyBgOpacity(bg) {
    if (reduceMotion.matches) bg.style.removeProperty("opacity");
    else if (bg.style.opacity !== "1") bg.style.opacity = "1";
  }
  reduceMotion.addEventListener?.("change", () => {
    const bg = document.querySelector(".site-background");
    if (bg) applyBgOpacity(bg);
  });

  let active = null;

  function ensure() {
    const bg = document.querySelector(".site-background");
    if (!bg) return;
    applyBgOpacity(bg);
    // Résidu d'une ancienne version : un conteneur vide (`.mandala-host`,
    // plus aucune règle CSS nulle part) occupait tout le fond sous la piste.
    // On le retire du DOM — idempotent, il ne revient pas.
    bg.querySelectorAll(":scope > .mandala-host, :scope > .unal-hero-media, :scope > .unal-hero-ring")
      .forEach((dead) => dead.remove());
    if (bg.querySelector(":scope > .unal-dmc")) return;
    if (active && active.isConnected) active.remove();
    injectStyle();
    const host = document.createElement("div");
    bg.insertBefore(host, bg.firstChild);
    mount(host);
    watch(host);
    active = host;
  }

  function boot() {
    injectStyle();
    const began = performance.now();
    const poll = setInterval(() => {
      const bg = document.querySelector(".site-background");
      if (bg) {
        clearInterval(poll);
        ensure();
        setInterval(ensure, 600);            // le shell React peut recréer le fond
        window.addEventListener("popstate", () => setTimeout(ensure, 300));
      } else if (performance.now() - began > 15000) {
        clearInterval(poll);
        console.warn("[unal-dmc] .site-background never appeared");
      }
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
