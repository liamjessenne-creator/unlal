// UNAL Market — animated background: Mandala Bloom (adapted from Originkit)
// Dependency-free vanilla WebGL port of the three.js Mandala Bloom shader.
// Faithful to the original: same fragment shader math and the same preset
// (line #F2E4CF, warm #59001C, cool #6900BA, 8 bands, 16-fold symmetry…).
// Works on WebGL2 (GLSL ES 3.00) and falls back to WebGL1 + derivatives ext.
// Pointer/hold interaction removed: this runs as a site-wide background.
(() => {
  "use strict";

  const MAX_BANDS = 8;
  const MOTIF_KINDS = 6.0;
  const CELL_FILL = 0.9;

  const DEFAULTS = {
    line: "#F2E4CF",
    warm: "#59001C",
    cool: "#6900BA",
    bands: 8,
    symmetry: 16,
    variety: 19,
    point: 6,
    fill: 20,
    weight: 1,
    rules: 0,
    spin: 10,
    scale: 200,
  };

  const clamp = (v, lo, hi, fallback) => {
    const n = typeof v === "number" && isFinite(v) ? v : fallback;
    return Math.max(lo, Math.min(hi, n));
  };

  const settingsFor = (c) => ({
    bands: Math.round(clamp(c.bands, 1, MAX_BANDS, DEFAULTS.bands)),
    symmetry: Math.round(clamp(c.symmetry, 3, 16, DEFAULTS.symmetry)),
    variety: clamp(c.variety, 0, 20, DEFAULTS.variety) / 20,
    point: 0.5 + clamp(c.point, 1, 20, DEFAULTS.point) * 0.11,
    fill: clamp(c.fill, 0, 20, DEFAULTS.fill) / 20,
    weight: Math.max(1.0, 0.6 + clamp(c.weight, 1, 20, DEFAULTS.weight) * 0.26),
    rules: clamp(c.rules, 0, 20, DEFAULTS.rules) * 0.09,
    spin: clamp(c.spin, 0, 20, DEFAULTS.spin) * 0.012,
    scale: clamp(c.scale, 20, 200, DEFAULTS.scale) / 100,
  });

  // ---- Oklab (no three.js) ----------------------------------------------
  const srgbToLinear = (u) =>
    u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);

  const hexToRgb = (hex) => {
    const h = (hex || "").replace("#", "");
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    const int = parseInt(full, 16);
    if (!isFinite(int)) return [0, 0, 0];
    return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
  };

  const toOklab = (hex) => {
    const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };

  // ---- Shader body (identical math to the Originkit original) ------------
  const FRAG_BODY = `
    #define MAX_BANDS ${MAX_BANDS}
    #define KINDS ${MOTIF_KINDS.toFixed(1)}
    #define CELL_FILL ${CELL_FILL}
    #define TAU 6.28318530718
    #define PI 3.14159265359

    uniform vec2 uResolution;
    uniform float uTurn;
    uniform vec3 uLine;
    uniform vec3 uWarm;
    uniform vec3 uCool;
    uniform float uBands;
    uniform float uSymmetry;
    uniform float uVariety;
    uniform float uPoint;
    uniform float uFill;
    uniform float uWeight;
    uniform float uRules;
    uniform float uScale;

    VARYING vec2 vUv;

    vec3 rgbFromOklab(vec3 lab) {
      float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
      float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
      float s = lab.x - 0.0894841775 * lab.y - 1.291485548 * lab.z;
      l = l * l * l;
      m = m * m * m;
      s = s * s * s;
      return vec3(
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
      );
    }

    float hash1(float n) {
      return fract(sin(n * 127.1 + 0.371) * 43758.5453123);
    }

    float motifDist(float kind, vec2 q, float inner, float outer, float sector) {
      float span = max(outer - inner, 0.0001);
      float t = clamp((q.x - inner) / span, 0.0, 1.0);

      float room = q.x * sin(sector * 0.5) * CELL_FILL;
      float mid = (inner + outer) * 0.5;
      float wide = mid * sin(sector * 0.5) * CELL_FILL;

      float fits = min(span * 0.5, wide);

      float d;
      if (kind < 1.0) {
        float taper = wide * pow(max(cos(PI * 0.5 * t), 0.0), uPoint);
        d = abs(q.y) - min(room, taper);
      } else if (kind < 2.0) {
        d = length(q - vec2(mid, 0.0)) - fits * 0.8;
      } else if (kind < 3.0) {
        float r = fits * 0.82;
        d = abs(length(q - vec2(mid, 0.0)) - r) - r * 0.34;
      } else if (kind < 4.0) {
        d = abs(q.y) - room * (1.0 - t);
      } else if (kind < 5.0) {
        float r = span * 0.85;
        d = abs(length(q - vec2(outer, 0.0)) - r) - span * 0.13;
        d = max(d, abs(q.y) - room);
      } else {
        vec2 c = q - vec2(mid, 0.0);
        float w = min(span, wide * 2.0) * 0.11;
        float bar = min(
          abs(dot(c, vec2(0.70710678, 0.70710678))) - w,
          abs(dot(c, vec2(0.70710678, -0.70710678))) - w
        );
        d = max(bar, abs(q.y) - room);
      }

      d = max(d, q.x - outer);
      return max(d, inner - q.x);
    }

    void main() {
      float unit = min(uResolution.x, uResolution.y);
      vec2 p = (vUv * uResolution - uResolution * 0.5) / (unit * uScale);

      float radius = length(p);
      float angle = atan(p.y, p.x) + uTurn;

      float span = 0.5;
      float bandWidth = span / uBands;
      if (radius > span) discard;

      vec3 lineCol = rgbFromOklab(uLine);
      vec3 col = vec3(0.0);
      float cover = 0.0;

      for (int i = 0; i < MAX_BANDS; i++) {
        float fi = float(i);
        if (fi < uBands) {
          float inner = fi * bandWidth;
          float outer = inner + bandWidth;

          if (radius < inner || radius > outer) continue;

          float reps = uSymmetry * pow(2.0, floor(fi * 0.5));
          float sector = TAU / reps;

          float a = mod(angle + sector * 0.5, sector) - sector * 0.5;
          vec2 q = vec2(cos(a), sin(a)) * radius;

          float kind = floor(hash1(fi * 5.7 + 2.1) * KINDS * uVariety);

          float d = motifDist(kind, q, inner, outer, sector);
          float aa = max(fwidth(d), 0.0001);
          float w = uWeight / (unit * uScale);

          float solid = 1.0 - smoothstep(-aa, aa, d);
          float stroke = 1.0 - smoothstep(w - aa, w + aa, abs(d));

          vec3 body = mod(fi, 2.0) < 0.5
            ? rgbFromOklab(uWarm)
            : rgbFromOklab(uCool);

          col = mix(col, body, solid * uFill);
          col = mix(col, lineCol, stroke);
          cover = max(cover, max(solid * uFill, stroke));
        }
      }

      if (uRules > 0.0) {
        float steps = radius / bandWidth;
        float toRule = min(fract(steps), 1.0 - fract(steps)) * bandWidth;
        float rule = min(toRule, abs(radius - span));
        float aaR = max(fwidth(radius), 0.0001);
        float wR = (uWeight * uRules) / (unit * uScale);
        float ink = 1.0 - smoothstep(wR - aaR, wR + aaR, rule);
        col = mix(col, lineCol, ink);
        cover = max(cover, ink);
      }

      if (cover < 0.004) discard;

      gl_FragColor = vec4(col * cover, cover);
    }
  `;

  const buildSources = (glsl3) =>
    glsl3
      ? {
          vertex: `#version 300 es
            in vec2 aPos;
            out vec2 vUv;
            void main() {
              vUv = aPos * 0.5 + 0.5;
              gl_Position = vec4(aPos, 0.0, 1.0);
            }
          `,
          fragment: `#version 300 es
            precision highp float;
            out vec4 fragColor;
            ${FRAG_BODY.replace(/VARYING/g, "in").replace(
              "gl_FragColor = vec4(col * cover, cover);",
              "fragColor = vec4(col * cover, cover);",
            )}
          `,
        }
      : {
          vertex: `
            attribute vec2 aPos;
            varying vec2 vUv;
            void main() {
              vUv = aPos * 0.5 + 0.5;
              gl_Position = vec4(aPos, 0.0, 1.0);
            }
          `,
          fragment: `#extension GL_OES_standard_derivatives : enable
            precision highp float;
            ${FRAG_BODY.replace(/VARYING/g, "varying")}
          `,
        };

  const compile = (gl, type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("[mandala] shader error:", gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };

  const start = () => {
    const container = document.querySelector(".site-background");
    if (!container || container.dataset.mandalaBound) return !!container;
    container.dataset.mandalaBound = "1";

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    const opts = { alpha: true, antialias: false, premultipliedAlpha: true };
    let gl = canvas.getContext("webgl2", opts);
    let isGL3 = !!gl;
    if (!gl) {
      gl =
        canvas.getContext("webgl", opts) ||
        canvas.getContext("experimental-webgl", opts);
    }
    if (!gl) {
      console.warn("[mandala] WebGL unavailable — background stays static");
      return true;
    }
    if (!isGL3) gl.getExtension("GL_OES_standard_derivatives");

    const src = buildSources(isGL3);
    const vs = compile(gl, gl.VERTEX_SHADER, src.vertex);
    const fs = compile(gl, gl.FRAGMENT_SHADER, src.fragment);
    if (!vs || !fs) return true;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[mandala] link error:", gl.getProgramInfoLog(prog));
      return true;
    }
    gl.useProgram(prog);

    // One oversized triangle covers the whole viewport.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const u = {
      uResolution: U("uResolution"),
      uTurn: U("uTurn"),
      uLine: U("uLine"),
      uWarm: U("uWarm"),
      uCool: U("uCool"),
      uBands: U("uBands"),
      uSymmetry: U("uSymmetry"),
      uVariety: U("uVariety"),
      uPoint: U("uPoint"),
      uFill: U("uFill"),
      uWeight: U("uWeight"),
      uRules: U("uRules"),
      uScale: U("uScale"),
    };

    const S = settingsFor(DEFAULTS);

    gl.uniform3fv(u.uLine, toOklab(DEFAULTS.line));
    gl.uniform3fv(u.uWarm, toOklab(DEFAULTS.warm));
    gl.uniform3fv(u.uCool, toOklab(DEFAULTS.cool));
    gl.uniform1f(u.uBands, S.bands);
    gl.uniform1f(u.uSymmetry, S.symmetry);
    gl.uniform1f(u.uVariety, S.variety);
    gl.uniform1f(u.uPoint, S.point);
    gl.uniform1f(u.uFill, S.fill);
    gl.uniform1f(u.uRules, S.rules);
    gl.uniform1f(u.uScale, S.scale);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
    gl.clearColor(0, 0, 0, 0);

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(container.clientWidth * dpr));
      const h = Math.max(1, Math.floor(container.clientHeight * dpr));
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uResolution, w, h);
      gl.uniform1f(u.uWeight, S.weight * dpr); // same as original: weight × pixelRatio
    };
    resize();
    window.addEventListener("resize", resize);

    let turn = 0;
    let lastT = performance.now();
    const loop = () => {
      const now = performance.now();
      let dt = (now - lastT) / 1000;
      lastT = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > 0.05) dt = 0.05;

      turn = (turn + dt * S.spin) % 1;
      gl.uniform1f(u.uTurn, turn * Math.PI * 2);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    console.info("[mandala] Mandala Bloom background running (WebGL" + (isGL3 ? "2" : "1") + ")");
    return true;
  };

  // .site-background is created by React after boot — poll until it exists.
  const boot = () => {
    if (start()) return;
    const began = performance.now();
    const poll = setInterval(() => {
      if (start()) {
        clearInterval(poll);
      } else if (performance.now() - began > 15000) {
        clearInterval(poll);
        console.warn("[mandala] .site-background never appeared");
      }
    }, 120);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
