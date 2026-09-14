// UNAL Market — Gallery Modal Accordion, faithful vanilla port.
//
// Port EXACT du composant fourni (AccordionModal) :
// - rangée d'images : la carte survolée se déplie à 250px, les autres restent
//   fines (14/20/30/50px selon breakpoint), hauteur 200px, radius 2xl,
//   whileTap scale .95, transition-[width] ease-in-out 300ms ;
// - clic → overlay fixe plein écran (noir 40% + backdrop-blur), image
//   focalisée 400×400 (layout partagé), cartouche en bas (verre 40% + blur)
//   avec titre + description, fermeture par clic dehors ou Échap ;
// - corps verrouillé (overflow hidden) tant que le modal est ouvert.
//
// Adaptations (contenu du site) : les 11 items démo deviennent les 8 photos
// locales du magasin (titre/description/tags adaptés), et le style s'accorde
// au site (fond sombre, texte clair) sans changer la mécanique.
//
// Zéro dépendance (motion/react → transitions CSS). `defer` depuis index.html.
(() => {
  "use strict";

  // ---- items (même structure que le composant) --------------------------------
  const ITEMS = [
    { id: 1, url: "/img/unal-01-interieur-comptoir.jpg", title: "Comptoir & saveurs", description: "Le comptoir d'UNAL MARKET : sandwichs, burgers, pâtes et tacos préparés sur place.", tags: ["Sur place", "Fait maison"] },
    { id: 2, url: "/img/unal-02-rayons.jpg", title: "Nos rayons", description: "Des rayons d'épicerie remplis de produits frais et de marques de confiance.", tags: ["Épicerie", "Frais"] },
    { id: 3, url: "/img/unal-03-facade-angle.jpg", title: "La façade", description: "La boutique vue depuis la rue, au cœur du centre-ville d'Armentières.", tags: ["Centre-ville", "Boutique"] },
    { id: 4, url: "/img/unal-04-facade-large.jpg", title: "Devant la boutique", description: "L'entrée principale d'UNAL MARKET, ouverte du mardi au dimanche.", tags: ["Accueil", "Ouvert 19h"] },
    { id: 5, url: "/img/unal-05-facade-terrasse.jpg", title: "La terrasse", description: "La terrasse de la boutique pour déguster sur place quand le ciel le permet.", tags: ["Terrasse", "Sur place"] },
    { id: 6, url: "/img/unal-06-etals.jpg", title: "Les étals du jour", description: "Fruits, légumes et spécialités locales renouvelés chaque matin.", tags: ["Du jour", "Local"] },
    { id: 7, url: "/img/unal-07-epicerie.jpg", title: "L'épicerie fine", description: "Une cave et une sélection d'épicerie fine : conserves, boissons, douceurs.", tags: ["Cave", "Épicerie fine"] },
    { id: 8, url: "/img/unal-08-commerce.jpg", title: "Le commerce", description: "Vue d'ensemble du magasin, entre tradition d'épicerie et snacking frais.", tags: ["Magasin", "Tradition"] },
  ];

  function injectStyle() {
    if (document.getElementById("unal-galacc-style")) return;
    const style = document.createElement("style");
    style.id = "unal-galacc-style";
    style.textContent = `
.unal-galrow { border-radius: .375rem; width: fit-content; margin-inline: auto;
  display: flex; gap: 4px; padding-bottom: 5rem; padding-top: 2.5rem; }
@media (min-width: 48rem) { .unal-galrow { gap: 8px; } }

.unal-galimg { border-radius: 1rem; height: 200px; flex-shrink: 0; object-fit: cover;
  width: 14px; transition: width .3s ease-in-out, transform .15s ease-in-out;
  cursor: pointer; display: block; background: #14161a; }
@media (min-width: 40rem) { .unal-galimg { width: 20px; } }
@media (min-width: 48rem) { .unal-galimg { width: 30px; } }
@media (min-width: 80rem) { .unal-galimg { width: 50px; } }
.unal-galimg.open { width: 250px; }
.unal-galimg:active { transform: scale(.95); }

/* modal */
.unal-galmodal { position: fixed; inset: 0; z-index: 50; display: grid; place-content: center;
  background: rgba(0, 0, 0, .4); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  opacity: 0; transition: opacity .25s ease; }
.unal-galmodal.in { opacity: 1; }
.unal-galmodal .wrap { padding: 1rem; }
.unal-galfocus { position: relative; width: 400px; max-width: 88vw; height: 400px; max-height: 70vh;
  border-radius: 1rem; overflow: hidden; cursor: default;
  transform: scale(.96); transition: transform .3s ease; box-shadow: 0 24px 70px rgba(0,0,0,.55); }
.unal-galmodal.in .unalf-galfocus, .unal-galmodal.in .unalf-galfocus { transform: scale(1); }
.unal-galmodal.in .unal-galfocus { transform: scale(1); }
.unal-galfocus img { width: 100%; height: 100%; object-fit: cover; display: block; }
.unal-galfocus article { position: absolute; bottom: -4px; left: 0; width: 100%;
  background: rgba(0, 0, 0, .4); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-radius: .375rem; padding: .5rem; color: #fff; }
.unal-galfocus h1 { font-size: 1.25rem; font-weight: 600; margin: 0;
  transform-origin: bottom; transform: scaleY(.2); opacity: 0;
  transition: transform .2s ease .2s, opacity .2s ease .2s; }
.unal-galfocus p { font-size: .875rem; line-height: 1.4; padding: .5rem 0; margin: 0;
  transform: translateY(-10px); opacity: 0;
  transition: transform .2s ease .2s, opacity .2s ease .2s; }
.unal-galmodal.in .unal-galfocus h1 { transform: scaleY(1); opacity: 1; }
.unal-galmodal.in .unal-galfocus p { transform: translateY(0); opacity: 1; }

@media (max-width: 30rem) {
  .unal-galrow { max-width: 100%; overflow-x: auto; justify-content: flex-start; scrollbar-width: none; }
  .unal-galrow::-webkit-scrollbar { display: none; }
}
`;
    document.head.appendChild(style);
  }

  // ---- état --------------------------------------------------------------------
  let index = 5; // défaut du composant (useState(5))
  let modal = null;

  function openModal() {
    closeModal();
    const item = ITEMS[index];
    modal = document.createElement("div");
    modal.className = "unal-galmodal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML =
      '<div class="wrap"><div class="unalf-galfocus"><div class="unal-galfocus">' +
      '<img src="' + item.url + '" alt="single-image">' +
      "<article><h1>" + item.title + "</h1><p>" + item.description + "</p>" +
      "</article></div></div></div>";
    modal.addEventListener("click", () => closeModal());
    modal.querySelector(".unalf-galfocus").addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden"; // classe overflow-hidden du composant
    requestAnimationFrame(() => modal.classList.add("in"));
  }

  function closeModal() {
    if (!modal) return;
    const m = modal;
    modal = null;
    m.classList.remove("in");
    document.body.style.overflow = "";
    setTimeout(() => m.remove(), 250);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  // ---- section (la page est rendue par React) ------------------------------------
  let rowHost = null;

  function buildRow() {
    const row = document.createElement("div");
    row.className = "unal-galrow";
    ITEMS.forEach((item, i) => {
      const img = document.createElement("img");
      img.className = "unal-galimg" + (i === index ? " open" : "");
      img.src = item.url;
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      img.addEventListener("mouseenter", () => {
        row.querySelectorAll(".unal-galimg").forEach((el) => el.classList.remove("open"));
        img.classList.add("open");
        index = i;
      });
      img.addEventListener("mouseleave", () => {
        img.classList.remove("open");
      });
      img.addEventListener("click", () => {
        index = i;
        openModal();
      });
      row.appendChild(img);
    });
    return row;
  }

  function ensureSection() {
    if (location.pathname !== "/") return;
    const main = document.querySelector("main");
    const footer = main && main.querySelector("footer");
    if (!footer) return;
    let section = document.getElementById("galerie");
    if (section && main.contains(section)) return;
    if (!section) {
      section = document.createElement("section");
      section.id = "galerie";
      section.className = "mx-auto max-w-7xl px-6 pb-16 lg:px-10 lg:pb-24";
      section.innerHTML =
        '<p class="font-mono text-xs uppercase tracking-[0.28em] text-zinc-400">UNAL_MARKET // GALERIE_02</p>' +
        '<h2 class="font-display mt-3 text-4xl tracking-[-0.01em] text-white sm:text-5xl">La galerie.</h2>';
    }
    if (!rowHost || !rowHost.isConnected) {
      rowHost = buildRow();
      section.appendChild(rowHost);
    }
    footer.parentNode.insertBefore(section, footer);
  }

  function boot() {
    injectStyle();
    setInterval(() => ensureSection(), 600);
    window.addEventListener("popstate", () => setTimeout(ensureSection, 300));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
