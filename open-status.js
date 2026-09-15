// UNAL Market — statut d'ouverture « en direct » (vanilla, sans dépendance).
//
// Pourquoi : le ruban affichait « OUVERT 19h · FERME 19H », ce qui contredisait
// le bandeau horaires (lundi→samedi 10h00–19h00, dimanche fermé) et comportait
// deux fautes (« FERME » sans accent, « 19h » / « 19H »). Ici l'info est
// CALCULÉE depuis les horaires réels, en heure de Paris, et rafraîchie toute
// seule ; le texte devient donc toujours juste.
//
// Ce que le script met à jour (aucune modification de mise en page) :
// - la ligne de statut du héro (à côté du point `.dot-live`) ;
// - le segment d'horaires du ruban défilant.
(() => {
  "use strict";

  // Horaires réels du commerce (heure locale de Paris).
  const OPEN_MIN = 10 * 60; // 10h00
  const CLOSE_MIN = 19 * 60; // 19h00
  const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // lundi → samedi
  const DAY_LABEL = [
    "dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi",
  ];
  const DAY_SHORT = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

  const CLOSE_TEXT = "19h00";
  const OPEN_TEXT = "10h00";
  const CLOSE_TICKER = "19H";
  const OPEN_TICKER = "10H";

  const nowInParis = () => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const pick = (type) => (parts.find((p) => p.type === type) || {}).value;
    const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const day = days[pick("weekday")];
    const mins = parseInt(pick("hour"), 10) * 60 + parseInt(pick("minute"), 10);
    return { day, mins };
  };

  // Renvoie l'état courant + la prochaine ouverture.
  function readStatus() {
    const { day, mins } = nowInParis();
    if (OPEN_DAYS.includes(day) && mins >= OPEN_MIN && mins < CLOSE_MIN) {
      return { open: true };
    }
    for (let step = 0; step <= 7; step++) {
      const d = (day + step) % 7;
      if (!OPEN_DAYS.includes(d)) continue;
      if (step === 0 && mins < OPEN_MIN) return { open: false, day: d, today: true };
      if (step > 0) return { open: false, day: d, today: false };
    }
    return { open: false, day: 1, today: false };
  }

  const statusText = (st) =>
    st.open
      ? "ouvert · ferme à " + CLOSE_TEXT
      : "fermé · ouvre " +
        (st.today ? "à " : DAY_LABEL[st.day] + " à ") +
        OPEN_TEXT;

  const tickerText = (st) =>
    st.open
      ? "OUVERT JUSQU'À " + CLOSE_TICKER
      : "FERMÉ · OUVRE " + DAY_SHORT[st.day] + " " + OPEN_TICKER;

  // ---- application -------------------------------------------------------------
  function applyStatus(st) {
    // 1) ligne de statut du héro : le point `.dot-live` est laissé intact,
    //    seul le texte qui le suit est remplacé.
    document.querySelectorAll(".dot-live").forEach((dot) => {
      const line = dot.parentElement;
      if (!line) return;
      const target = statusText(st);
      const nodes = [...line.childNodes].filter((n) => n.nodeType === 3);
      const current = nodes.map((n) => n.textContent).join("").trim();
      if (current === target) return;
      nodes.forEach((n) => n.remove());
      line.appendChild(document.createTextNode(" " + target));
    });

    // 2) ruban : segment d'horaires (créé par ui-polish.js, séparateur ✦
    //    conservé à l'identique pour ne pas décaler le défilement)
    document.querySelectorAll("span").forEach((el) => {
      if (el.children.length) return;
      const raw = el.textContent;
      if (!/HORAIRES|OUVERT\s*19h|FERME\s*19H/i.test(raw)) return;
      const mark = raw.indexOf("✦");
      const tail = mark >= 0 ? raw.slice(mark) : "";
      const next = tickerText(st) + (tail ? "   " + tail : "");
      if (raw === next) return;
      el.textContent = next;
    });
  }

  function tick() {
    try {
      applyStatus(readStatus());
    } catch (err) {
      /* jamais bloquant : le site reste utilisable même si Intl manque */
    }
  }

  function boot() {
    tick();
    setInterval(tick, 2000); // survit aux re-rendus React et au passage d'heure
    window.addEventListener("popstate", () => setTimeout(tick, 300));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
