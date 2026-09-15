// UNAL Market — onglet « à l'image de Google » vers la fiche de l'établissement.
//
// Pourquoi : la boutique existe sur Google Maps / Google Search mais le site ne
// renvoie vers aucune fiche, et n'affiche même pas l'adresse complète (seul
// « Menu digital · Armentières » apparaît). Ici, une pastille blanche au logo
// Google (4 couleurs) ouvre la fiche dans un nouvel onglet, avec l'adresse en
// dessous.
//
// Où : au centre du hero, entre le grand titre et le paragraphe de
// présentation — c'est le seul endroit de la page où le regard passe déjà, donc
// la fiche ne coûte aucun effort à trouver. Elle flotte doucement sur place
// (animation coupée si l'utilisateur préfère limiter les mouvements).
//
// Sur les autres pages (pas de hero), la même pastille rejoint la grappe de
// liens du pied de page : une seule par page, jamais deux, et aucune mise en
// page existante n'est restructurée.
//
// La fiche (relevée le 15/09/2026) :
//   nom        « unal market » (catégorie Supermarché)
//   adresse    Pl. Thiers, 59280 Armentières — coordonnées 50.6874918 / 2.8777468
//   note       5,0 étoiles · 2 avis (photo à côté = snapshot : la constante
//              RATING ci-dessous est à rafraîchir quand la fiche bouge)
//   lieu       0x47dcd7acd572534d:0x541362cbf5cea3f8 · /g/11nw0s_r05
//   site       unal-armentieres.vercel.app (déjà renseigné sur la fiche)
// L'URL est celle que Google Maps produit lui-même pour ce lieu : elle ouvre
// directement la fiche (« Partager » / lien court possibles côté Google).
(() => {
  "use strict";

  const MAPS_URL =
    "https://www.google.com/maps/place/unal+market/" +
    "@50.6874918,2.8777468,17z/" +
    "data=!4m6!3m5!1s0x47dcd7acd572534d:0x541362cbf5cea3f8" +
    "!8m2!3d50.6874918!4d2.8777468!16s%2Fg%2F11nw0s_r05?hl=fr";

  const ADDRESS = "3 place Thiers · 59280 Armentières";

  // Relevé sur la fiche (voir l'en-tête).
  const RATING = "5,0";
  const REVIEWS = "2";

  const LABEL =
    "Voir unal market sur Google Maps — " + RATING + " étoiles, " + REVIEWS +
    " avis (nouvel onglet)";

  // Logo « G » de Google, dans ses quatre couleurs officielles.
  const G_LOGO =
    "<svg viewBox=\"0 0 48 48\" aria-hidden=\"true\" focusable=\"false\">" +
    "<path fill=\"#EA4335\" d=\"M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z\"/>" +
    "<path fill=\"#4285F4\" d=\"M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z\"/>" +
    "<path fill=\"#FBBC05\" d=\"M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z\"/>" +
    "<path fill=\"#34A853\" d=\"M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z\"/>" +
    "</svg>";

  // Étoile jaune Google (#FBBC05), pour la pastille de note.
  const STAR =
    "<svg class=\"unal-gtap__star\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\">" +
    "<path fill=\"#FBBC05\" d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z\"/></svg>";

  const CSS =
    ".unal-gtapband { padding-inline: 1.5rem; padding-block: 1.4rem 0.2rem; }" +
    "@media (min-width: 64rem) { .unal-gtapband { padding-inline: 2.5rem; } }" +
    ".unal-gtapband--footer { padding: 0; }" +
    ".unal-gtaprow {" +
    "  max-width: 80rem; margin-inline: auto;" +
    "  display: flex; flex-wrap: wrap; align-items: center; gap: 0.85rem 1.25rem;" +
    "  font-family: \"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, monospace;" +
    "}" +
    ".unal-gtapaddr {" +
    "  margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.18em;" +
    "  text-transform: uppercase; color: rgba(255, 255, 255, 0.62);" +
    "}" +
    ".unal-gtap--footer .unal-gtapaddr { display: none; }" +
    // Même composition que les cartes horaires au-dessus : libellé à gauche,
    // valeur à droite. Sur mobile on reste aligné à gauche.
    "@media (min-width: 40rem) { .unal-gtapband:not(.unal-gtapband--footer) .unal-gtap { margin-left: auto; } }" +
    ".unal-gtap {" +
    "  display: inline-flex; align-items: center; gap: 0.55rem;" +
    "  height: 2.75rem; padding-inline: 1rem 0.9rem;" +
    "  border-radius: 999px; background: #ffffff; color: #202124;" +
    "  text-decoration: none; white-space: nowrap;" +
    "  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.38);" +
    "  transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;" +
    "}" +
    ".unal-gtap:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0, 0, 0, 0.46); }" +
    ".unal-gtap:focus-visible { outline: 2px solid #4285F4; outline-offset: 3px; }" +
    ".unal-gtap svg { width: 1.15rem; height: 1.15rem; display: block; flex: none; }" +
    ".unal-gtap__score { display: inline-flex; align-items: center; gap: 0.25rem; }" +
    ".unal-gtap__star { width: 0.95rem !important; height: 0.95rem !important; }" +
    ".unal-gtap__num { font-size: 12px; font-weight: 800; color: #202124; letter-spacing: 0.02em; }" +
    ".unal-gtap__count { font-size: 11px; font-weight: 600; color: #5f6368; letter-spacing: 0.02em; }" +
    ".unal-gtap__brand { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }" +
    ".unal-gtap__muted { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #5f6368; }" +
    ".unal-gtap__dot { color: #dadce0; }" +
    ".unal-gtap__go { font-size: 12px; font-weight: 700; color: #5f6368; margin-left: 0.05rem; }" +
    // -- Variante de hero : plus grande, plus lumineuse, et elle flotte. --
    ".unal-gtaphero {" +
    "  display: flex; flex-direction: column; align-items: flex-start;" +
    "  gap: 0.6rem; margin: 1.4rem 0 1.35rem;" +
    "}" +
    ".unal-gtapfloat {" +
    "  display: inline-flex;" +
    "  animation: unal-gtap-float 6.5s ease-in-out infinite;" +
    "  will-change: transform;" +
    "}" +
    "@keyframes unal-gtap-float {" +
    "  0%, 100% { transform: translateY(0); }" +
    "  50% { transform: translateY(-5px); }" +
    "}" +
    "@media (prefers-reduced-motion: reduce) { .unal-gtapfloat { animation: none; } }" +
    ".unal-gtaphero .unal-gtap {" +
    "  height: 3.35rem; padding-inline: 1.25rem 1.05rem; gap: 0.65rem;" +
    "  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.75);" +
    "}" +
    ".unal-gtaphero .unal-gtap svg { width: 1.35rem; height: 1.35rem; }" +
    ".unal-gtaphero .unal-gtap__star { width: 1.05rem !important; height: 1.05rem !important; }" +
    ".unal-gtaphero .unal-gtap__brand { font-size: 12.5px; letter-spacing: 0.13em; }" +
    ".unal-gtaphero .unal-gtap__num { font-size: 13.5px; }" +
    ".unal-gtaphero .unal-gtap__count," +
    ".unal-gtaphero .unal-gtap__go { font-size: 12px; }" +
    ".unal-gtaphero .unal-gtapaddr {" +
    "  padding-left: 0.15rem; font-size: 10.5px; color: rgba(255, 255, 255, 0.6);" +
    "}";

  function ensureStyle() {
    if (document.getElementById("unal-gtap-style")) return;
    const style = document.createElement("style");
    style.id = "unal-gtap-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildTab(compact) {
    const a = document.createElement("a");
    a.className = "unal-gtap" + (compact ? " unal-gtap--compact" : "");
    a.href = MAPS_URL;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", LABEL);
    a.title = "unal market · " + RATING + " ★ (" + REVIEWS + " avis) · Google Maps";
    // Même lecture que Google : le logo, le nom, la note « 5,0(2) » puis la sortie.
    a.innerHTML =
      G_LOGO +
      "<span class=\"unal-gtap__brand\">UNAL MARKET</span>" +
      "<span class=\"unal-gtap__dot\" aria-hidden=\"true\">·</span>" +
      "<span class=\"unal-gtap__score\">" +
      STAR +
      "<span class=\"unal-gtap__num\">" + RATING + "</span>" +
      "<span class=\"unal-gtap__count\">(" + REVIEWS + ")</span>" +
      "</span>" +
      "<span class=\"unal-gtap__go\" aria-hidden=\"true\">↗</span>";
    return a;
  }

  function buildBand() {
    const band = document.createElement("div");
    band.className = "unal-gtaphero";
    band.id = "unal-gtap-band";

    const float = document.createElement("span");
    float.className = "unal-gtapfloat";
    float.appendChild(buildTab(false));

    const addr = document.createElement("p");
    addr.className = "unal-gtapaddr";
    addr.textContent = ADDRESS;

    band.appendChild(float);
    band.appendChild(addr);
    return band;
  }

  // Le grand titre du hero, et le paragraphe de présentation qui le suit.
  function heroSlot() {
    const title =
      document.querySelector("h1") ||
      document.querySelector('[role="heading"][aria-level="1"]');
    if (!title) return null;

    // Le titre est enveloppé par le composant d'animation, et le paragraphe de
    // présentation vit un ou deux niveaux plus haut : on remonte jusqu'à
    // l'ancêtre qui contient les deux, sans jamais dépasser le hero.
    let host = title.parentElement;
    for (let depth = 0; depth < 4 && host; depth++) {
      const paragraphs = [...host.querySelectorAll("p")];
      const after = paragraphs.filter(
        (p) => title.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING
      );
      if (after.length) {
        const para =
          after.find((p) => /épicerie|restaurant|présentation/i.test(p.textContent || "")) ||
          after[0];
        if (para.parentElement) return { title, para };
      }
      host = host.parentElement;
    }
    return null;
  }

  // Onglet compact dans la grappe du pied de page (autres pages).
  function mountInFooter() {
    const footer = document.querySelector("footer");
    if (!footer) return false;
    const cluster = footer.querySelector("span.flex, span[class*='gap-4']") || footer;
    if (cluster.querySelector(".unal-gtap")) return true;
    const holder = document.createElement("span");
    holder.className = "unal-gtapband unal-gtapband--footer";
    holder.appendChild(buildTab(true));
    // Avant le dernier lien de la grappe : la mise en page du pied de page
    // garde exactement le même nombre d'items, juste un de plus dans la grappe.
    const lastLink = cluster.querySelector("a:last-of-type");
    if (lastLink) cluster.insertBefore(holder, lastLink);
    else cluster.appendChild(holder);
    return true;
  }

  function mount() {
    if (document.querySelector(".unal-gtap")) return; // déjà posé (ou re-rendu)

    // Le hero n'existe que sur l'accueil : ailleurs, la pastille garde sa place
    // dans le pied de page et aucune autre page ne bouge.
    const isHome = location.pathname === "/" || location.pathname === "/index.html";
    const slot = isHome ? heroSlot() : null;
    if (slot) {
      const existing = document.getElementById("unal-gtap-band");
      if (existing) return;
      // Inséré *avant* le paragraphe, donc pile entre le titre et lui.
      slot.para.parentElement.insertBefore(buildBand(), slot.para);
      return;
    }
    mountInFooter();
  }

  function boot() {
    ensureStyle();
    mount();
    // survit au re-rendu React et aux changements de route
    setInterval(() => {
      ensureStyle();
      mount();
    }, 2000);
    window.addEventListener("popstate", () => setTimeout(mount, 300));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
