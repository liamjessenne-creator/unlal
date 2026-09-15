// UNAL Market — la photo du plat dans chaque catégorie du menu.
//
// Les cinq photos fournies sont des prises de vue studio sur fond gris clair.
// Elles ont été détourées (script dans _audit, le fond et l'assiette retirés,
// alpha conservé) : seuls les plats sont déposés ici. Aucune n'est générée.
//
// Où : dans la colonne de gauche de chaque carte de catégorie, juste sous le
// sous-titre — c'est l'espace qui était vide, donc la page ne s'allonge pas
// d'un bloc de plus, elle se remplit. `menu-data` donne le contenu des cartes ;
// on ne le réécrit pas, on ajoute un nœud à côté, donc les mises à jour de prix
// continuent de fonctionner normalement.
(() => {
  "use strict";

  const BASE = "/img/menu/";

  // Une photo par catégorie, dans l'ordre du menu (menu-data : froid, chaud,
  // burger, pates, tacos).
  const CATEGORIES = [
    {
      id: "froid",
      file: "cat-01-sandwich-froid",
      width: 595,
      height: 313,
      alt:
        "Deux moitiés de sandwich froid : baguette fraîche, jambon, tomate et " +
        "salade, servies sur assiette.",
    },
    {
      id: "chaud",
      file: "cat-02-sandwich-chaud",
      width: 599,
      height: 300,
      alt:
        "Deux moitiés de sandwich chaud grillé, fromage fondu et jambon, " +
        "servies sur assiette.",
    },
    {
      id: "burger",
      file: "cat-03-burger",
      width: 356,
      height: 358,
      alt:
        "Cheeseburger : pain brioché, steak, cheddar fondu, tomate et salade, " +
        "servi sur assiette.",
    },
    {
      id: "pates",
      file: "cat-05-pates",
      width: 494,
      height: 279,
      alt:
        "Pâtes fraîches à la crème et aux champignons, parmesan et persil, " +
        "servies sur assiette.",
    },
    {
      id: "tacos",
      file: "cat-04-tacos",
      width: 480,
      height: 294,
      alt:
        "Tacos grillé coupé en deux, accompagné d'un quartier de citron vert, " +
        "servi sur assiette.",
    },
  ];

  // La hauteur est fixée, pas la largeur : les cinq plats ont des cadrages très
  // différents (un burger presque carré, un sandwich trois fois plus large), et
  // c'est la hauteur qui les fait lire à la même échelle. `width:auto` garde les
  // proportions de chaque photo, `max-width` empêche tout débordement en mobile.
  const CSS =
    ".unal-catmedia { margin: 1.5rem 0 0; }" +
    ".unal-catmedia img {" +
    // width/height restent `auto` et ce sont les deux maximums qui cadrent : le
    // navigateur réduit alors l'image en gardant ses proportions, alors qu'une
    // hauteur imposée + max-width la déformerait sur un téléphone étroit.
    "  display: block; width: auto; height: auto;" +
    "  max-width: min(100%, 21rem);" +
    "  max-height: clamp(9.5rem, 36vw, 12.5rem);" +
    // Les plats sont détourés : l'ombre portée leur donne une assise, sinon ils
    // « flottent » sur la carte sans que rien ne les tienne.
    "  filter: drop-shadow(0 16px 22px rgba(4, 6, 9, 0.5));" +
    "}";

  function ensureStyle() {
    if (document.getElementById("unal-catmedia-style")) return;
    const style = document.createElement("style");
    style.id = "unal-catmedia-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function figure(item) {
    const wrap = document.createElement("figure");
    wrap.className = "unal-catmedia";
    wrap.dataset.unalCat = item.id;

    const picture = document.createElement("picture");
    const webp = document.createElement("source");
    webp.type = "image/webp";
    webp.srcset = BASE + item.file + ".webp";
    const img = document.createElement("img");
    img.src = BASE + item.file + ".png";
    img.alt = item.alt;
    img.width = item.width;
    img.height = item.height;
    img.loading = "lazy";
    img.decoding = "async";

    picture.appendChild(webp);
    picture.appendChild(img);
    wrap.appendChild(picture);
    return wrap;
  }

  // La colonne de gauche de la carte : celle qui porte le numéro, le titre et
  // le sous-titre. On s'y accroche à la fin, donc sous le sous-titre.
  function columnFor(section) {
    const heading = section.querySelector("h2");
    return heading ? heading.parentElement : null;
  }

  function mount() {
    for (const item of CATEGORIES) {
      const section = document.getElementById(item.id);
      if (!section || section.dataset.unalCatDone === "1") continue;
      const column = columnFor(section);
      if (!column) continue;
      column.appendChild(figure(item));
      section.dataset.unalCatDone = "1";
    }
  }

  function boot() {
    ensureStyle();
    mount();
    // React remplace ses enfants à chaque rendu et change de route sans
    // recharger : on repasse, sans jamais poser deux fois la même image.
    setInterval(() => {
      ensureStyle();
      mount();
    }, 1500);
    window.addEventListener("popstate", () => setTimeout(mount, 250));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
