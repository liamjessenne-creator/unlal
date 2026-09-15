// UNAL Market — métadonnées par route (SPA) — vanilla, sans dépendance.
//
// Pourquoi : le site est une application React côté client, donc l'onglet
// affichait le même titre et la même description sur toutes les pages, et
// `link[rel=canonical]` restait figé sur l'accueil. Ce script aligne titre,
// description et canonique sur la route courante (et retombe proprement sur la
// 404). Aucun impact visuel : c'est strictement de la métadonnée.
(() => {
  "use strict";

  const ORIGIN = "https://unal-armentieres.vercel.app";

  const ROUTES = {
    "/": {
      title: "UNAL Market · Armentières",
      desc: "Épicerie-restaurant au 3 place Thiers à Armentières : sandwichs, burgers, pâtes et tacos, à emporter ou à déguster sur place.",
    },
    "/menu": {
      title: "La carte · UNAL Market Armentières",
      desc: "Le menu complet d'UNAL MARKET : sandwichs froids et chauds, burgers, pâtes et tacos, avec les prix et les formules boisson + frite.",
    },
    "/informations-legales": {
      title: "Informations légales · UNAL Market",
      desc: "Éditeur, hébergeur et mentions légales du menu digital d'UNAL MARKET à Armentières.",
    },
  };

  const FALLBACK = {
    title: "Page introuvable · UNAL Market",
    desc: "Cette page n'existe pas. Retournez à l'accueil d'UNAL MARKET, menu digital d'Armentières.",
  };

  const metaDesc = () => document.querySelector('meta[name="description"]');
  const canonical = () => document.querySelector('link[rel="canonical"]');

  function apply() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    const page = ROUTES[path] || FALLBACK;

    if (document.title !== page.title) document.title = page.title;

    const desc = metaDesc();
    if (desc && desc.getAttribute("content") !== page.desc) {
      desc.setAttribute("content", page.desc);
    }

    const link = canonical();
    const href = ORIGIN + (ROUTES[path] ? path : "/");
    if (link && link.getAttribute("href") !== href) link.setAttribute("href", href);
  }

  function boot() {
    apply();
    setInterval(apply, 1500); // la page est rendue par React : on repasse après
    window.addEventListener("popstate", () => setTimeout(apply, 300));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
