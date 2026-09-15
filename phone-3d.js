// UNAL Market — floating 3D iPhone v6.
//
// Consignes respectées :
// - le widget n'est PAS « bougeable » : aucune rotation au glisser ; il garde
//   uniquement son effet 3D flottant (sway + roulis + flottement vertical) ;
// - rendu 3D nettement plus fini :
//     * maillage « pebble » : bande de titane au rayon maximal, congé poli
//       (roll) entre la bande et les faces, dos et verre plats — c'est la
//       silhouette d'un vrai iPhone, pas une boîte à arêtes vives ;
//     * normales analytiques par station (le congé capte donc la lumière) ;
//     * éclairage métallique : environnement studio procédural (ciel / sol +
//       deux bandes de lumière douces) réfléchi par la bande et le congé ;
//     * verre d'écran : réflexion dépendante de l'angle de vue + bande
//       spéculaire + occlusion douce sur les bords ;
//     * anti-aliasing matériel (MSAA) + sur-échantillonnage jusqu'à 2.5× DPR ;
// - l'écran affiche une VRAIE carte MapLibre (styles du composant fourni) avec
//   un pin sur « 3 place Thiers, Armentières » ;
// - on ne « plonge » dans la carte QUE si le clic tombe pile sur le téléphone :
//   test géométrique sur la silhouette exacte (contour arrondi dense projeté,
//   tolérance nulle) PUIS test au pixel près (readPixels sur le canal alpha du
//   dernier rendu). Un clic à 1 px du téléphone ne déclenche rien.
//
// Vanilla WebGL2 + MapLibre GL JS (chargé à la demande). Zéro framework.
(() => {
  "use strict";

  const POINT = { lng: 2.8778, lat: 50.6877, zoom: 16.6 };
  const ADDRESS = "3 place Thiers, 59280 Armentières";

  const STYLES = {
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  };
  const MAPLIBRE_VERSION = "5.6.0";
  const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
  const MAPLIBRE_JS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
  const GOTO = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`;

  // ---- dimensions (unités monde) ---------------------------------------------
  const W = 1.0;        // largeur
  const H = 2.02;       // hauteur
  const D = 0.155;      // épaisseur du châssis
  const R = 0.15;       // rayon des coins de la silhouette
  const ROLL = 0.03;    // rayon du congé poli entre la bande et les faces
  const ARCS = 8;       // segments du congé
  const SEG = 30;       // segments par arc de coin de la silhouette (maillage)
  const HIT_SEG = 24;   // segments par arc de coin pour le test de clic
  const CAM_Z = 3.8;    // recul de la caméra (le téléphone remplit le cadre)

  // Texture de l'écran (coordonnées de dessin ; canvas sur-échantillonné).
  const TW = 516, TH = 1052;
  const SS = 1.2;
  const CW = Math.round(TW * SS), CH = Math.round(TH * SS);

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ---- MapLibre à la demande --------------------------------------------------
  let maplibrePromise = null;
  function loadMapLibre() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (maplibrePromise) return maplibrePromise;
    maplibrePromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = MAPLIBRE_CSS;
      document.head.appendChild(css);
      const s = document.createElement("script");
      s.src = MAPLIBRE_JS;
      s.async = true;
      s.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre absent")));
      s.onerror = () => reject(new Error("maplibre introuvable"));
      document.head.appendChild(s);
    });
    return maplibrePromise;
  }

  // Repli hors-ligne : plan stylisé, jamais d'écran vide.
  function drawFallbackMap(g, w, h) {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#0b1017");
    bg.addColorStop(1, "#05070b");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,0.07)";
    g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 54) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
    }
    for (let i = -w; i < w + h; i += 96) {
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i + w * 0.42); g.stroke();
    }
    g.strokeStyle = "rgba(255,255,255,0.16)";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-20, h * 0.62);
    g.lineTo(w * 0.44, h * 0.55);
    g.lineTo(w * 0.72, h * 0.30);
    g.lineTo(w + 20, h * 0.24);
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.10)";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(w * 0.18, -20);
    g.lineTo(w * 0.34, h + 20);
    g.stroke();
  }

  // ---- silhouette -------------------------------------------------------------
  // Contour d'un rectangle arrondi, demi-tailles données (rayon déjà déduit),
  // dans le sens trigonométrique.
  function roundedRectPoints(hw, hh, rad, seg) {
    const pts = [];
    const cx = hw - rad, cy = hh - rad;
    const corners = [
      [cx, cy, 0],
      [-cx, cy, 90],
      [-cx, -cy, 180],
      [cx, -cy, 270],
    ];
    for (const [ox, oy, a0] of corners) {
      for (let i = 0; i <= seg; i++) {
        const a = ((a0 + (i / seg) * 90) * Math.PI) / 180;
        pts.push([ox + rad * Math.cos(a), oy + rad * Math.sin(a)]);
      }
    }
    return pts;
  }

  // Profil transversal du châssis, de la face avant à la face arrière.
  // u = distance rentrante depuis la silhouette, z = hauteur.
  function chassisProfile() {
    const hz = D / 2;
    const p = [];
    // face avant (le verre) : rentrée de ROLL, normale +z
    p.push({ u: ROLL, z: hz, nr: 0, nz: 1, face: 0 });
    // congé avant : (u = ROLL, z = hz) -> (u = 0, z = hz - ROLL)
    for (let k = ARCS - 1; k >= 1; k--) {
      const th = (k / ARCS) * (Math.PI / 2);
      p.push({
        u: ROLL - ROLL * Math.cos(th),
        z: hz - ROLL + ROLL * Math.sin(th),
        nr: Math.cos(th),
        nz: Math.sin(th),
        face: 3,
      });
    }
    // bande de titane (au rayon maximal) : z de +(hz-ROLL) à -(hz-ROLL)
    p.push({ u: 0, z: -(hz - ROLL), nr: 1, nz: 0, face: 2 });
    // congé arrière
    for (let k = 1; k <= ARCS - 1; k++) {
      const th = (k / ARCS) * (Math.PI / 2);
      p.push({
        u: ROLL - ROLL * Math.cos(th),
        z: -(hz - ROLL) - ROLL * Math.sin(th),
        nr: Math.cos(th),
        nz: -Math.sin(th),
        face: 3,
      });
    }
    // face arrière (dos) : normale -z
    p.push({ u: ROLL, z: -hz, nr: 0, nz: -1, face: 1 });
    return p;
  }

  function buildMesh(seg) {
    const outline = roundedRectPoints(W / 2, H / 2, R, seg);
    const n = outline.length;
    const profile = chassisProfile();
    const pn = profile.length;

    const hwF = W / 2 - ROLL, hhF = H / 2 - ROLL;
    const V = [];
    const idx = [];
    const push = (x, y, z, nx, ny, nz, u, v, face) => {
      V.push(x, y, z, nx, ny, nz, u, v, face);
      return V.length / 9 - 1;
    };
    const uvFace = (x, y) => [x / (2 * hwF) + 0.5, y / (2 * hhF) + 0.5];

    // anneaux : un par station du profil
    const rings = [];
    for (let s = 0; s < pn; s++) {
      const st = profile[s];
      const ring = [];
      for (let i = 0; i < n; i++) {
        const [x, y] = outline[i];
        const len = Math.hypot(x, y) || 1;
        const ox = x / len, oy = y / len;      // normale 2D extérieure approx.
        const px = x - st.u * ox;
        const py = y - st.u * oy;
        const nx = st.nr * ox, ny = st.nr * oy, nz = st.nz;
        const l = Math.hypot(nx, ny, nz) || 1;
        if (st.face === 0 || st.face === 1) {
          const [u, v] = uvFace(px, py);
          ring.push(push(px, py, st.z, nx / l, ny / l, nz / l, st.face === 0 ? u : 1 - u, st.face === 0 ? v : 1 - v, st.face));
        } else {
          ring.push(push(px, py, st.z, nx / l, ny / l, nz / l, i / n, s / (pn - 1), st.face));
        }
      }
      rings.push(ring);
    }

    // faces avant / arrière (éventails depuis le centre)
    const cFront = push(0, 0, D / 2, 0, 0, 1, 0.5, 0.5, 0);
    const front = rings[0];
    for (let i = 0; i < n; i++) idx.push(cFront, front[i], front[(i + 1) % n]);

    const cBack = push(0, 0, -D / 2, 0, 0, -1, 0.5, 0.5, 1);
    const back = rings[pn - 1];
    for (let i = 0; i < n; i++) idx.push(cBack, back[(i + 1) % n], back[i]);

    // bande + congés : quads entre stations
    for (let s = 0; s < pn - 1; s++) {
      const a = rings[s], b = rings[s + 1];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        idx.push(a[i], a[j], b[j], a[i], b[j], b[i]);
      }
    }

    return { data: new Float32Array(V), indices: new Uint16Array(idx), count: idx.length };
  }

  // ---- shaders ----------------------------------------------------------------
  const VERT = `#version 300 es
in vec3 aPos;
in vec3 aNor;
in vec2 aUv;
in float aFace;
uniform mat4 uMVP;
uniform mat4 uModel;
out vec2 vUv;
out vec3 vNor;
out float vFace;
out vec3 vWorld;
void main() {
  vUv = aUv;
  vFace = aFace;
  vNor = mat3(uModel) * aNor;
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vNor;
in float vFace;
in vec3 vWorld;
out vec4 outColor;
uniform sampler2D uScreen;
uniform sampler2D uBack;
uniform vec3 uCam;

// Environnement studio procédural : sol sombre, horizon, ciel clair + deux
// bandes de lumière douces. C'est ce que réfléchissent la bande et le congé,
// et c'est ce qui fait lire le titane comme du métal (et pas du plastique).
vec3 envSample(vec3 r) {
  float up = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 ground  = vec3(0.030, 0.038, 0.055);
  vec3 horizon = vec3(0.240, 0.290, 0.380);
  vec3 sky     = vec3(0.780, 0.860, 1.000);
  vec3 col = mix(ground, horizon, smoothstep(0.30, 0.52, up));
  col = mix(col, sky, smoothstep(0.54, 0.98, up));
  float s1 = smoothstep(0.16, 0.0, abs(r.y - 0.68)) * smoothstep(0.42, 0.0, abs(r.x + 0.30));
  float s2 = smoothstep(0.10, 0.0, abs(r.y - 0.34)) * smoothstep(0.34, 0.0, abs(r.x - 0.62));
  float s3 = smoothstep(0.07, 0.0, abs(r.x)) * smoothstep(0.35, 0.0, abs(r.y - 0.50));
  col += vec3(1.000, 0.985, 0.950) * (s1 * 1.25 + s2 * 0.75 + s3 * 0.45);
  return col;
}

void main() {
  vec3 N = normalize(vNor);
  vec3 V = normalize(uCam - vWorld);
  vec3 L = normalize(vec3(0.35, 0.62, 0.85));
  vec3 R = reflect(-V, N);
  float diff = max(dot(N, L), 0.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float ndv  = max(dot(N, V), 0.0);

  vec3 col;

  if (vFace < 0.5) {
    // ---- verre d'écran --------------------------------------------------------
    vec2 q = vUv - 0.5;
    float centred = 1.0 - smoothstep(0.34, 0.54, max(abs(q.x), abs(q.y)));
    vec3 t = texture(uScreen, vUv).rgb;
    // occlusion douce le long des bords du verre
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float ao = 0.80 + 0.20 * smoothstep(0.0, 0.055, edge);
    col = t * ao * (0.885 + 0.115 * diff) * (0.78 + 0.22 * centred);
    // reflet de verre : dépend de l'angle de vue, glisse quand le téléphone flotte
    float sheen = smoothstep(0.16, -0.44, q.x + q.y * 0.55) * 0.10;
    col += vec3(sheen) * (0.6 + 0.4 * fres);
    col += envSample(R) * 0.030 * (0.35 + fres);
  } else if (vFace < 1.5) {
    // ---- dos : verre dépoli + bloc photo -------------------------------------
    vec3 t = texture(uBack, vUv).rgb;
    col = t * (0.55 + 0.55 * diff);
    col += envSample(R) * 0.085 * (0.4 + fres);
  } else if (vFace < 2.5) {
    // ---- bande de titane : métal brossé --------------------------------------
    vec3 albedo = vec3(0.640, 0.678, 0.735);
    // brossage : les micro-stries verticales étirent la réflexion
    vec3 Rr = normalize(R + vec3(0.0, 0.30 * sin(vWorld.y * 42.0), 0.0));
    vec3 refl = envSample(Rr);
    col = refl * albedo * 0.92;
    col += albedo * diff * 0.12;
    col += albedo * pow(diff, 20.0) * 0.28;
  } else {
    // ---- congé poli : c'est lui qui donne le fini « usine » -------------------
    vec3 albedo = vec3(0.880, 0.910, 0.955);
    float sharp = pow(max(dot(N, normalize(L + V)), 0.0), 120.0);
    col = envSample(R) * albedo * 0.74;
    col += albedo * pow(diff, 8.0) * 0.18;
    col += vec3(1.0) * sharp * 0.95;
  }

  // lumière de contour : les arêtes se détachent sur le fond sombre
  col += vec3(0.50, 0.66, 0.96) * fres * (vFace < 1.5 ? 0.22 : 0.55);
  col += vec3(0.02, 0.025, 0.035) * (1.0 - ndv);
  outColor = vec4(col, 1.0);
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("phone-3d:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function mat4Mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        o[c * 4 + r] =
          a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }

  function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f;
    m[10] = (far + near) * nf; m[11] = -1;
    m[14] = 2 * far * near * nf;
    return m;
  }

  function rotationXY(rx, ry) {
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const m = new Float32Array(16);
    m[0] = cy;       m[2] = sy;
    m[4] = sx * sy;  m[5] = cx;  m[6] = -sx * cy;
    m[8] = -cx * sy; m[9] = sx;  m[10] = cx * cy;
    m[15] = 1;
    return m;
  }

  function rotationZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m = new Float32Array(16);
    m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
    m[10] = 1; m[15] = 1;
    return m;
  }

  // dos du téléphone
  function buildBackTexture() {
    const c = document.createElement("canvas");
    c.width = TW; c.height = TH;
    const g = c.getContext("2d");
    const back = g.createLinearGradient(0, 0, TW, TH);
    back.addColorStop(0, "#26303f");
    back.addColorStop(0.45, "#151d2b");
    back.addColorStop(1, "#0a101c");
    rr(g, 0, 0, TW, TH, 46);
    g.fillStyle = back; g.fill();

    rr(g, 44, 44, 210, 210, 52);
    g.fillStyle = "#1c2434"; g.fill();
    g.strokeStyle = "rgba(255,255,255,0.14)"; g.lineWidth = 3; g.stroke();
    const lens = (x, y, r) => {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
      g.fillStyle = "#05070d"; g.fill();
      g.beginPath(); g.arc(x, y, r * 0.62, 0, Math.PI * 2);
      g.fillStyle = "#101a2c"; g.fill();
      g.beginPath(); g.arc(x - r * 0.22, y - r * 0.22, r * 0.2, 0, Math.PI * 2);
      g.fillStyle = "rgba(160,190,255,0.5)"; g.fill();
    };
    lens(104, 104, 38); lens(194, 104, 38); lens(104, 194, 38);
    g.beginPath(); g.arc(194, 194, 12, 0, Math.PI * 2);
    g.fillStyle = "#e8dfc8"; g.fill();

    g.fillStyle = "rgba(255,255,255,0.16)";
    g.font = "700 120px system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("U", TW / 2, TH / 2);
    return c;
  }

  // ---- écran : cadre titane + carte live + pin + habillage iOS ----------------
  function paintScreen(g, map) {
    const inner = { x: 24, y: 24, w: TW - 48, h: TH - 48, r: 34 };

    const frame = g.createLinearGradient(0, 0, TW, TH);
    frame.addColorStop(0, "#eef3fa");
    frame.addColorStop(0.35, "#b9c4d3");
    frame.addColorStop(0.5, "#8d99ab");
    frame.addColorStop(0.75, "#dfe7f1");
    frame.addColorStop(1, "#aab6c6");
    rr(g, 0, 0, TW, TH, 46);
    g.fillStyle = frame; g.fill();
    rr(g, 11, 11, TW - 22, TH - 22, 40);
    g.fillStyle = "#04060c"; g.fill();

    g.save();
    rr(g, inner.x, inner.y, inner.w, inner.h, inner.r);
    g.clip();
    g.fillStyle = "#070a10";
    g.fillRect(inner.x, inner.y, inner.w, inner.h);

    let pinX = inner.x + inner.w / 2;
    let pinY = inner.y + inner.h * 0.5;

    if (map) {
      const src = map.getCanvas();
      const sw = src.width, sh = src.height;
      const scale = Math.max(inner.w / sw, inner.h / sh);
      const dw = sw * scale, dh = sh * scale;
      g.drawImage(src, inner.x + (inner.w - dw) / 2, inner.y + (inner.h - dh) / 2, dw, dh);
      const p = map.project([POINT.lng, POINT.lat]);
      pinX = inner.x + (inner.w - dw) / 2 + p.x * scale;
      pinY = inner.y + (inner.h - dh) / 2 + p.y * scale;
    } else {
      drawFallbackMap(g, TW, TH);
      pinX = inner.x + inner.w * 0.46;
      pinY = inner.y + inner.h * 0.56;
    }

    // pin : halo + point net
    g.beginPath(); g.arc(pinX, pinY, 30, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.10)"; g.fill();
    g.beginPath(); g.arc(pinX, pinY, 18, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.16)"; g.fill();
    g.beginPath(); g.arc(pinX, pinY, 9.5, 0, Math.PI * 2);
    g.fillStyle = "#ffffff"; g.fill();
    g.lineWidth = 3.5;
    g.strokeStyle = "rgba(6,10,18,0.6)";
    g.stroke();

    // pastille d'adresse
    const label = "UNAL MARKET · 3 PLACE THIERS";
    g.font = "700 20px ui-monospace, SFMono-Regular, Menlo, monospace";
    const lw = g.measureText(label).width + 48;
    const lx = Math.max(inner.x + 14, Math.min(pinX - lw / 2, inner.x + inner.w - lw - 14));
    const ly = Math.min(pinY + 30, inner.y + inner.h - 140);
    rr(g, lx, ly, lw, 46, 23);
    g.fillStyle = "rgba(6,9,15,0.84)"; g.fill();
    g.strokeStyle = "rgba(255,255,255,0.24)"; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = "#f2f5f9";
    g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(label, lx + 24, ly + 24);

    // CTA verre
    const cta = "OUVRIR LA CARTE  ↗";
    g.font = "800 22px ui-monospace, SFMono-Regular, Menlo, monospace";
    const cw = g.measureText(cta).width + 60;
    const cx = inner.x + (inner.w - cw) / 2;
    const cy = inner.y + inner.h - 108;
    rr(g, cx, cy, cw, 62, 31);
    g.fillStyle = "rgba(255,255,255,0.14)"; g.fill();
    g.strokeStyle = "rgba(255,255,255,0.36)"; g.lineWidth = 2; g.stroke();
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.fillText(cta, cx + cw / 2, cy + 32);

    // barre d'état + dynamic island
    g.fillStyle = "rgba(3,8,18,0.72)";
    g.fillRect(inner.x, inner.y, inner.w, 56);
    rr(g, TW / 2 - 74, 42, 148, 30, 15);
    g.fillStyle = "#000"; g.fill();
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.font = "600 21px system-ui, sans-serif";
    g.textAlign = "left"; g.fillText("9:41", 54, 52);
    g.textAlign = "right"; g.fillText("100%", TW - 54, 52);
    g.restore();
  }

  // ---- overlay plein écran ----------------------------------------------------
  function buildOverlay() {
    let ov = document.getElementById("unal-map-overlay");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.id = "unal-map-overlay";
    ov.className = "unal-map-overlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-label", "Carte interactive — UNAL MARKET, 3 place Thiers, Armentières");
    ov.innerHTML =
      '<div class="unal-map-canvas"></div>' +
      '<div class="unal-map-top">' +
      '<span class="unal-map-kicker">UNAL_MARKET // CARTE_03</span>' +
      '<span class="unal-map-title">3 place Thiers, Armentières</span>' +
      "</div>" +
      '<a class="unal-map-cta" href="' + GOTO + '" target="_blank" rel="noopener noreferrer">ITINÉRAIRE ↗</a>' +
      '<button class="unal-map-close" type="button" aria-label="Fermer la carte">✕</button>';
    document.body.appendChild(ov);
    return ov;
  }

  function createMarkerEl() {
    const el = document.createElement("div");
    el.className = "unal-map-marker";
    el.innerHTML =
      '<span class="unal-map-pin" aria-hidden="true"></span>' +
      '<span class="unal-map-label">UNAL MARKET · 3 PLACE THIERS</span>';
    return el;
  }

  // ---- test de clic PRÉCIS ----------------------------------------------------
  // Deux verrous successifs :
  //  1. silhouette exacte : le contour arrondi réel (rayon R, dense) est projeté
  //     aux deux faces du châssis, on en prend l'enveloppe convexe — c'est
  //     mathématiquement la silhouette du maillage. Tolérance : zéro.
  //  2. pixel exact : on relit l'alpha du dernier rendu au pixel cliqué ; le
  //     téléphone est le seul objet opaque dessiné, donc alpha > 0 = pile dessus.
  function makeSilhouette(outline) {
    const project = (m, x, y, z, cssW, cssH) => {
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (!cw) return null;
      return {
        x: (cx / cw * 0.5 + 0.5) * cssW,
        y: (1 - (cy / cw * 0.5 + 0.5)) * cssH,
      };
    };
    const hull = (pts) => {
      const p = pts.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const lower = [];
      for (const q of p) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
        lower.push(q);
      }
      const upper = [];
      for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
        upper.push(q);
      }
      return lower.slice(0, -1).concat(upper.slice(0, -1));
    };
    const inside = (poly, px, py) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
        if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) hit = !hit;
      }
      return hit;
    };
    return (m, rect, clientX, clientY) => {
      if (!m || !rect.width || !rect.height) return false;
      const cssW = rect.width, cssH = rect.height;
      const pts = [];
      for (const z of [D / 2, -D / 2]) {
        for (const [x, y] of outline) {
          const p = project(m, x, y, z, cssW, cssH);
          if (p) pts.push(p);
        }
      }
      if (pts.length < 8) return false;
      return inside(hull(pts), clientX - rect.left, clientY - rect.top);
    };
  }

  function start(canvas) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,   // nécessaire pour le test de clic au pixel
      powerPreference: "high-performance",
    });
    if (!gl) { console.warn("[phone-3d] WebGL2 unavailable"); return false; }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("phone-3d link:", gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    const mesh = buildMesh(SEG);
    const hitOutline = roundedRectPoints(W / 2, H / 2, R, HIT_SEG);
    const silhouette = makeSilhouette(hitOutline);

    // Écran visible : même repère que la texture (encadré de 24, rayon 34 — voir
    // screenTexture), exprimé en unités monde. Sert de fenêtre de départ / d'arrivée
    // à l'animation « plongeon » vers la carte.
    const SX = W / TW, SY = H / TH;
    const glassOutline = roundedRectPoints(
      (TW / 2 - 24) * SX,
      (TH / 2 - 24) * SY,
      Math.max(0.01, 34 * SX),
      10
    );

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    const stride = 9 * 4;
    const aPos = gl.getAttribLocation(prog, "aPos");
    const aNor = gl.getAttribLocation(prog, "aNor");
    const aUv = gl.getAttribLocation(prog, "aUv");
    const aFace = gl.getAttribLocation(prog, "aFace");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aNor);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(aFace);
    gl.vertexAttribPointer(aFace, 1, gl.FLOAT, false, stride, 32);

    const uMVP = gl.getUniformLocation(prog, "uMVP");
    const uModel = gl.getUniformLocation(prog, "uModel");
    gl.uniform1i(gl.getUniformLocation(prog, "uScreen"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "uBack"), 1);
    gl.uniform3f(gl.getUniformLocation(prog, "uCam"), 0, 0, CAM_Z);

    const texScreen = gl.createTexture();
    const texBack = gl.createTexture();

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texBack);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildBackTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = CW;
    screenCanvas.height = CH;
    const sctx = screenCanvas.getContext("2d");
    sctx.setTransform(SS, 0, 0, SS, 0, 0); // dessin en coordonnées TW×TH
    paintScreen(sctx, null);

    const uploadScreen = () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texScreen);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screenCanvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    uploadScreen();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);

    // ---- carte MapLibre partagée écran <-> overlay --------------------------
    const host = canvas.parentElement;
    const mapHost = document.createElement("div");
    mapHost.className = "unal-map-host";
    host.appendChild(mapHost);

    let map = null;
    let mapReady = false;
    let textureDirty = false;
    let marker = null;

    loadMapLibre()
      .then((ML) => {
        map = new ML.Map({
          container: mapHost,
          style: STYLES.dark,
          center: [POINT.lng, POINT.lat],
          zoom: POINT.zoom,
          pitch: 42,
          bearing: -18,
          renderWorldCopies: false,
          attributionControl: { compact: true },
          preserveDrawingBuffer: true,
        });
        map.on("render", () => { textureDirty = true; });
        map.on("load", () => { mapReady = true; textureDirty = true; });
        map.on("error", () => {});
      })
      .catch(() => {});

    // ---- overlay ------------------------------------------------------------
    let overlayOpen = false;
    const overlay = buildOverlay();
    const mapSlot = overlay.querySelector(".unal-map-canvas");
    const closeBtn = overlay.querySelector(".unal-map-close");

    // Tant qu'elles sont hors écran, la modale et la carte qui alimente la
    // texture de l'écran sont décoratives : `inert` + `aria-hidden` évitent des
    // arrêts de tabulation invisibles et l'annonce d'un dialogue fantôme.
    const setTree = (el, hidden) => {
      if (!el) return;
      if (hidden) {
        el.setAttribute("inert", "");
        el.setAttribute("aria-hidden", "true");
      } else {
        el.removeAttribute("inert");
        el.removeAttribute("aria-hidden");
      }
    };
    setTree(overlay, true);   // modale fermée au départ
    setTree(mapHost, true);   // carte-texture (invisible) du widget

    // ---- ouverture « plongeon » ---------------------------------------------
    // La carte s'ouvre PAR l'écran du téléphone : on projette l'écran visible
    // (même gabarit arrondi que la texture) avec la matrice du dernier rendu, et
    // sa boîte à l'écran devient le `clip-path` de départ de la modale, qui
    // grandit ensuite jusqu'au viewport entier. La caméra MapLibre accompagne le
    // mouvement (16.6 -> 17.4), donc la fenêtre s'ouvre EN avançant : c'est ce
    // qui donne la sensation de plonger dedans plutôt qu'un simple fondu.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const DIVE_MS = 680;   // doit rester aligné sur la durée CSS du `clip-path`

    function screenBoxNow() {
      const m = mvpNow;
      const r = canvas.getBoundingClientRect();
      if (!m || !r.width || !r.height) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of glassOutline) {
        const cz = D / 2;
        const cx = m[0] * x + m[4] * y + m[8] * cz + m[12];
        const cy = m[1] * x + m[5] * y + m[9] * cz + m[13];
        const cw = m[3] * x + m[7] * y + m[11] * cz + m[15];
        if (!cw) continue;
        const px = r.left + ((cx / cw) * 0.5 + 0.5) * r.width;
        const py = r.top + (1 - ((cy / cw) * 0.5 + 0.5)) * r.height;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      if (!isFinite(minX) || !(maxX > minX) || !(maxY > minY)) return null;
      return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX };
    }

    // Boîte de l'écran -> `clip-path` (coordonnées du viewport, la modale est
    // `position: fixed ; inset: 0`). Le rayon suit la largeur projetée pour que
    // les coins du téléphone restent ceux de la fenêtre pendant tout le trajet.
    function screenClip(box) {
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const fit = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
      const left = fit(box.left, 0, vw);
      const top = fit(box.top, 0, vh);
      const right = fit(vw - box.right, 0, vw - left);
      const bottom = fit(vh - box.bottom, 0, vh - top);
      // 34 = rayon des coins DANS la texture, 468 = largeur de l'écran dans la
      // texture : la boîte projetée donne directement les pixels par texel.
      const radius = Math.max(8, Math.round((34 * box.width) / (TW - 48)));
      return "inset(" + Math.round(top) + "px " + Math.round(right) + "px " +
        Math.round(bottom) + "px " + Math.round(left) + "px round " + radius + "px)";
    }

    const FLAT = "inset(0px round 0px)";

    function openMap() {
      if (overlayOpen) return;
      overlayOpen = true;
      const box = screenBoxNow();
      const dive = !!box && !reduceMotion.matches;

      mapSlot.appendChild(mapHost);
      setTree(mapHost, false);
      setTree(overlay, false);
      document.body.style.overflow = "hidden";
      if (map) map.resize();

      if (dive) {
        // état de départ : la carte EST l'écran du téléphone, à sa place exacte
        overlay.style.transition = "none";
        overlay.style.clipPath = screenClip(box);
      } else {
        overlay.style.clipPath = FLAT;
      }
      overlay.classList.add("in");
      if (dive) {
        void overlay.offsetWidth;      // on fige le départ avant de peindre la suite
        overlay.style.transition = ""; // on rend la main aux transitions CSS
        overlay.style.clipPath = FLAT;
      }

      if (map) {
        map.flyTo({
          center: [POINT.lng, POINT.lat],
          zoom: 17.4,
          pitch: 48,
          bearing: -18,
          duration: dive ? DIVE_MS + 320 : 0,
        });
        if (!marker) {
          marker = new window.maplibregl.Marker({ element: createMarkerEl(), anchor: "bottom" })
            .setLngLat([POINT.lng, POINT.lat])
            .addTo(map);
        }
      }
      closeBtn.focus();
    }

    function closeMap() {
      if (!overlayOpen) return;
      overlayOpen = false;
      setTree(overlay, true);   // on ne pioche plus dans la carte pendant la remontée

      const box = screenBoxNow();
      const rise = !!box && !reduceMotion.matches;

      if (map) {
        // la caméra repart vers le cadrage de l'écran du téléphone, donc le
        // widget se retrouve exactement comme avant le clic
        map.flyTo({
          center: [POINT.lng, POINT.lat],
          zoom: POINT.zoom,
          pitch: 42,
          bearing: -18,
          duration: rise ? DIVE_MS : 0,
        });
      }

      const finish = () => {
        if (overlayOpen) return;      // rouvert entre-temps : on ne démonte rien
        overlay.classList.remove("in");
        overlay.style.clipPath = FLAT;
        document.body.style.overflow = "";   // la page redevient défilable
        // (après l'animation : sinon la barre de défilement revient pendant le
        //  mouvement, la mise en page se décale de ~17 px et la fenêtre manque
        //  légèrement l'écran du téléphone)
        host.appendChild(mapHost);
        setTree(mapHost, true);
        if (map) map.resize();
        host.focus();                 // le focus revient sur le téléphone
        if (marker) { marker.remove(); marker = null; }
      };

      if (rise) {
        overlay.style.transition = "";
        overlay.style.clipPath = screenClip(box);   // la fenêtre se referme dedans
        setTimeout(finish, DIVE_MS);
      } else {
        finish();
      }
    }
    closeBtn.addEventListener("click", closeMap);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeMap(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMap(); });

    // ---- interaction : clic PRÉCIS sur le téléphone uniquement --------------
    let mvpNow = null;
    const pickPixel = new Uint8Array(4);

    const onSilhouette = (x, y) => silhouette(mvpNow, canvas.getBoundingClientRect(), x, y);

    // pixel exact : l'alpha du dernier rendu (le téléphone est le seul objet opaque)
    const onPixel = (x, y) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height || !canvas.width) return false;
      const px = Math.floor(((x - r.left) / r.width) * canvas.width);
      const py = canvas.height - 1 - Math.floor(((y - r.top) / r.height) * canvas.height);
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return false;
      try {
        gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pickPixel);
      } catch (err) {
        return onSilhouette(x, y);
      }
      return pickPixel[3] > 16;
    };

    canvas.style.cursor = "default";
    let press = null;

    canvas.addEventListener("pointermove", (e) => {
      const on = onSilhouette(e.clientX, e.clientY);
      canvas.style.cursor = on ? "pointer" : "default";
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) press = null;
    });
    canvas.addEventListener("pointerleave", () => {
      canvas.style.cursor = "default";
      press = null;
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (!onSilhouette(e.clientX, e.clientY)) return;   // 1 px à côté = rien
      press = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!press) return;
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      const held = performance.now() - press.t;
      press = null;
      if (moved > 8 || held > 800) return;               // c'était un glissement / un scroll
      if (!onPixel(e.clientX, e.clientY)) return;        // et il faut être pile sur le widget
      openMap();
    });
    canvas.addEventListener("pointercancel", () => { press = null; });

    // accessibilité : le focus clavier ouvre la carte (pas de clic « à côté »)
    host.setAttribute("role", "button");
    host.setAttribute("tabindex", "0");
    host.setAttribute("aria-label", "Ouvrir la carte — UNAL MARKET, 3 place Thiers, Armentières");
    host.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMap(); }
    });

    // Hors écran (ou onglet caché) on arrête de dessiner : même rendu, moins de
    // batterie. La dernière image reste dans le canvas (preserveDrawingBuffer).
    let onScreen = true;
    const visibility = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((records) => {
          onScreen = records[records.length - 1]?.isIntersecting ?? true;
        }, { rootMargin: "150px" })
      : null;
    visibility?.observe(canvas);

    let raf = 0;
    const MAX_DPR = 2.5;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!onScreen || document.hidden) return;
      const t = now / 1000;

      // flottement 3D uniquement (aucune rotation utilisateur) : sway + roulis
      const yaw = -0.40 + Math.sin(t * 0.42) * 0.15;
      const pitch = 0.09 + Math.cos(t * 0.33) * 0.05;
      const roll = Math.sin(t * 0.27) * 0.045;
      const floatY = Math.sin(t * 1.05) * 0.045;

      if (mapReady && textureDirty) {
        textureDirty = false;
        paintScreen(sctx, map);
        uploadScreen();
      }

      resize();
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const aspect = canvas.width / Math.max(1, canvas.height);
      const proj = perspective(0.62, aspect, 0.1, 40);
      const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -CAM_Z, 1]);
      let mvp = mat4Mul(proj, view);

      const model = mat4Mul(rotationZ(roll), rotationXY(pitch, yaw));
      model[13] = floatY;
      mvp = mat4Mul(mvp, model);
      mvpNow = mvp;   // utilisé par le test de clic, avec la géométrie de la frame

      gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniformMatrix4fv(uModel, false, model);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }
    raf = requestAnimationFrame(frame);

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); cancelAnimationFrame(raf);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      raf = requestAnimationFrame(frame);
    });

    console.info("[phone-3d] iPhone v6 — float only, silhouette + pixel hit-test, live map @ " + ADDRESS);
    return true;
  }

  function boot() {
    const bind = () => {
      let n = 0;
      document.querySelectorAll("[data-phone-3d]:not([data-phone3d-bound])").forEach((host) => {
        host.dataset.phone3dBound = "1";
        host.style.position = host.style.position || "relative";
        const wrapper = host.parentElement;
        if (wrapper && wrapper !== document.body) {
          wrapper.style.maxWidth = "460px";
          wrapper.style.width = "100%";
        }
        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-hidden", "true");
        host.appendChild(canvas);
        if (start(canvas)) n++;
      });
      return n;
    };
    bind();
    setInterval(bind, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
