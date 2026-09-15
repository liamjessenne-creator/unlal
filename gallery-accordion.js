// UNAL Market — Gallery Modal Accordion (vanilla, accessible).
//
// Mêmes visuels que le port du composant AccordionModal (bande de vignettes qui
// se déplient au survol, lightbox plein écran avec cartouche) — la mécanique
// n'est pas touchée. Ce qui est corrigé ici :
// - chaque vignette est un VRAI <button> : focusable, activable par Entrée /
//   Espace, nommé (titre + description) pour les lecteurs d'écran ;
// - l'agrandissement se déclenche aussi au `focus` clavier (pas seulement au
//   survol souris) avec un anneau de focus visible ;
// - tactile : le premier appui déplie la vignette, le second ouvre la lightbox
//   (sans survol, l'ancienne version ne pouvait pas se déplier) ;
// - `alt` descriptif sur les photos (SEO + lecteurs d'écran) — il était vide ;
// - lightbox : `role="dialog"` + `aria-modal` + `aria-labelledby`, bouton de
//   fermeture visible, focus déplacé dedans puis RESTITUÉ à la vignette
//   d'origine ; le titre passe en <h2> (une seule h1 par page).
//
// Zéro dépendance. `defer` depuis index.html.
(() => {
  "use strict";

  // ---- items (même structure que le composant) --------------------------------
  const ITEMS = [
    { id: 1, url: "/img/unal-01-interieur-comptoir.jpg", title: "Rayons & épicerie", description: "L'intérieur du magasin : rayons d'épicerie, produits du quotidien et cave à vins.", tags: ["Épicerie", "Cave"] },
    { id: 2, url: "/img/unal-02-rayons.jpg", title: "Le comptoir à sandwichs", description: "Le comptoir de préparation, entre ardoises de prix, pains frais et boissons.", tags: ["Sur place", "Fait ici"] },
    { id: 3, url: "/img/unal-03-facade-angle.jpg", title: "Pains & vitrine", description: "La vitrine réfrigérée : pains, paninis et sandwichs prêts à emporter.", tags: ["À emporter", "Fraîcheur"] },
    { id: 4, url: "/img/unal-04-facade-large.jpg", title: "Snacks & douceurs", description: "Le rayon snacks : chips, biscuits et gourmandises pour la pause de midi.", tags: ["Rayon", "Pause"] },
    { id: 5, url: "/img/unal-05-facade-terrasse.jpg", title: "L'espace sur place", description: "Tables hautes et tabourets, juste à l'abri du comptoir pour manger sur place.", tags: ["Sur place", "Se poser"] },
    { id: 6, url: "/img/unal-06-etals.jpg", title: "Les allées", description: "Les allées du magasin, entre vitrines réfrigérées et rayons du quotidien.", tags: ["Magasin", "Frais"] },
    { id: 7, url: "/img/unal-07-epicerie.jpg", title: "L'angle place Thiers", description: "La façade en brique du magasin, avec son enseigne ronde UNAL MARKET.", tags: ["Place Thiers", "Façade"] },
    { id: 8, url: "/img/unal-08-commerce.jpg", title: "La devanture", description: "La devanture complète : pains, paninis, sandwichs et livraison rapide.", tags: ["Sandwichs", "Pains"] },
  ];

  function injectStyle() {
    if (document.getElementById("unal-galacc-style")) return;
    const style = document.createElement("style");
    style.id = "unal-galacc-style";
    style.textContent = `
.unal-galrow { border-radius: .375rem; width: fit-content; margin-inline: auto;
  display: flex; gap: 4px; padding-bottom: 5rem; padding-top: 2.5rem; }
@media (min-width: 48rem) { .unal-galrow { gap: 8px; } }

/* la vignette est un <button> : c'est lui qui porte la géométrie et la
   transition de largeur (l'image ne fait que remplir) */
.unal-galtile { border: 0; padding: 0; margin: 0; appearance: none; -webkit-appearance: none;
  background: #14161a; border-radius: 1rem; height: 200px; flex-shrink: 0;
  width: 14px; overflow: hidden; display: block; cursor: pointer;
  transition: width .3s ease-in-out, transform .15s ease-in-out; }
@media (min-width: 40rem) { .unal-galtile { width: 20px; } }
@media (min-width: 48rem) { .unal-galtile { width: 30px; } }
@media (min-width: 80rem) { .unal-galtile { width: 50px; } }
.unal-galtile.open { width: 250px; }
.unal-galtile:active { transform: scale(.95); }
.unal-galtile:focus-visible { outline: 2px solid rgba(215, 222, 231, .9); outline-offset: 3px; }
.unal-galimg { width: 100%; height: 100%; object-fit: cover; display: block; }

/* modal */
.unal-galmodal { position: fixed; inset: 0; z-index: 50; display: grid; place-content: center;
  background: rgba(0, 0, 0, .4); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  opacity: 0; transition: opacity .25s ease; }
.unal-galmodal.in { opacity: 1; }
.unal-galmodal .wrap { padding: 1rem; }
.unal-galfocus { position: relative; width: 400px; max-width: 88vw; height: 400px; max-height: 70vh;
  border-radius: 1rem; overflow: hidden; cursor: default;
  transform: scale(.96); transition: transform .3s ease; box-shadow: 0 24px 70px rgba(0,0,0,.55); }
.unal-galmodal.in .unal-galfocus { transform: scale(1); }
.unal-galfocus img { width: 100%; height: 100%; object-fit: cover; display: block; }
.unal-galfocus article { position: absolute; bottom: -4px; left: 0; width: 100%;
  background: rgba(0, 0, 0, .4); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-radius: .375rem; padding: .5rem; color: #fff; }
.unal-galfocus h2 { font-size: 1.25rem; font-weight: 600; margin: 0;
  transform-origin: bottom; transform: scaleY(.2); opacity: 0;
  transition: transform .2s ease .2s, opacity .2s ease .2s; }
.unal-galfocus p { font-size: .875rem; line-height: 1.4; padding: .5rem 0; margin: 0;
  transform: translateY(-10px); opacity: 0;
  transition: transform .2s ease .2s, opacity .2s ease .2s; }
.unal-galmodal.in .unal-galfocus h2 { transform: scaleY(1); opacity: 1; }
.unal-galmodal.in .unal-galfocus p { transform: translateY(0); opacity: 1; }
/* sortie de la lightbox (Échap / ✕ / clic à côté) */
.unal-galclose { position: absolute; top: max(1rem, env(safe-area-inset-top)); right: 1rem; z-index: 2;
  width: 44px; height: 44px; border: 1px solid rgba(255,255,255,.25); border-radius: 999px;
  background: rgba(6, 9, 15, .6); color: #f2f5f9; font-size: 1rem; line-height: 1;
  cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.unal-galclose:focus-visible { outline: 2px solid rgba(255,255,255,.7); outline-offset: 3px; }

@media (max-width: 30rem) {
  .unal-galrow { max-width: 100%; overflow-x: auto; justify-content: flex-start; scrollbar-width: none; }
  .unal-galrow::-webkit-scrollbar { display: none; }
}
`;
    document.head.appendChild(style);
  }

  // ---- état --------------------------------------------------------------------
  // Départ équilibré sur la bande des 8 photos (4 vignettes de chaque côté).
  let index = 4;
  let modal = null;
  let lastTile = null;

  function openModal(from) {
    closeModal();
    lastTile = from || null;
    const item = ITEMS[index];
    modal = document.createElement("div");
    modal.className = "unal-galmodal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "unal-galmodal-title");
    modal.innerHTML =
      '<button class="unal-galclose" type="button" aria-label="Fermer la photo">✕</button>' +
      '<div class="wrap"><div class="unalf-galfocus"><div class="unal-galfocus">' +
      '<img src="' + item.url + '" alt="' + item.title + ' — ' + item.description + '">' +
      '<article><h2 id="unal-galmodal-title">' + item.title + "</h2><p>" + item.description + "</p>" +
      "</article></div></div></div>";
    modal.addEventListener("click", () => closeModal());
    modal.querySelector(".unalf-galfocus").addEventListener("click", (e) => e.stopPropagation());
    const close = modal.querySelector(".unal-galclose");
    close.addEventListener("click", (e) => { e.stopPropagation(); closeModal(); });
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden"; // classe overflow-hidden du composant
    requestAnimationFrame(() => modal.classList.add("in"));
    close.focus();
  }

  function closeModal() {
    if (!modal) return;
    const m = modal;
    modal = null;
    m.classList.remove("in");
    document.body.style.overflow = "";
    setTimeout(() => m.remove(), 250);
    // le focus revient d'où il vient : on ne « perd » pas l'utilisateur clavier
    if (lastTile && lastTile.isConnected) lastTile.focus();
    lastTile = null;
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  // ---- section (la page est rendue par React) ------------------------------------
  let rowHost = null;

  function setOpen(tile) {
    const row = tile.parentElement;
    row.querySelectorAll(".unal-galtile").forEach((el) => el.classList.remove("open"));
    tile.classList.add("open");
  }

  function buildRow() {
    const row = document.createElement("div");
    row.className = "unal-galrow";
    row.setAttribute("role", "list");
    row.setAttribute("aria-label", "Photos du magasin");
    ITEMS.forEach((item, i) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "unal-galtile" + (i === index ? " open" : "");
      tile.setAttribute("role", "listitem");
      tile.setAttribute("aria-label", item.title + " — " + item.description + ". Agrandir la photo.");
      const img = document.createElement("img");
      img.className = "unal-galimg";
      img.src = item.url;
      // alt réel (indexation d'images + repli si le CSS ne charge pas) : le
      // nom accessible est porté par l'aria-label du bouton, donc pas de doublon
      img.alt = item.title;
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;
      tile.appendChild(img);

      const reveal = () => { setOpen(tile); index = i; };
      tile.addEventListener("mouseenter", reveal);
      tile.addEventListener("focus", () => { index = i; tile.classList.add("open"); });
      tile.addEventListener("mouseleave", () => tile.classList.remove("open"));
      tile.addEventListener("blur", () => tile.classList.remove("open"));
      tile.addEventListener("click", () => {
        // tactile : le premier appui déplie, le second ouvre (pas de survol)
        if (!tile.classList.contains("open")) { reveal(); return; }
        index = i;
        openModal(tile);
      });
      row.appendChild(tile);
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
