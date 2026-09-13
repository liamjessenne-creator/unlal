// UNAL Market — site background: Ray Column (Originkit), faithful port.
// The shaders, preset values, and pointer interaction are unchanged from the
// provided component; only the React wrapper is replaced by vanilla JS that
// mounts the canvas inside the app's .site-background element.
// WebGL1 first (as the original), with a WebGL2 fallback for browsers
// lacking WebGL1 (the shaders are version-agnostic GLSL ES 1.00).
(() => {
  "use strict";

  const MAX_DPR = 2;

  const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  const FRAG_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uHover;

const float PI  = 3.14159265;
const float TAU = 6.28318531;

float sat(float x){ return clamp(x, 0.0, 1.0); }
float pw(float x, float e){ return pow(max(x, 1e-5), e); }
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 34.56); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.07 + vec2(4.1, 2.3); a *= 0.5; } return s; }

uniform vec3 uBg, uBase, uAccent, uHigh;
uniform float uRays, uContrast, uSweep, uFall, uAper, uDirection;

void main(){
  float ar = uRes.x / max(uRes.y, 1.0);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float t = uTime * 0.07;

  float dcs = cos(uDirection), dsn = sin(uDirection);
  mat2 drot = mat2(dcs, -dsn, dsn, dcs);
  p = drot * p;
  vec2 src = vec2(0.0, -0.78);
  vec2 d = p - src;
  float r = max(length(d), 1e-3);
  float th = atan(d.x, d.y);

  vec2 mp = drot * ((uMouse - 0.5) * vec2(ar, 1.0));
  vec2 md = mp - src;
  float mr = max(length(md), 1e-3);
  float mth = atan(md.x, md.y);
  float ang = abs(mod(th - mth + PI, TAU) - PI);
  float aw = max(uAper, 0.02);
  float h = sat(uHover);
  float swell = 1.0 + 0.55 * exp(-pw(abs(r - mr) / 0.40, 2.0));
  float open  = h * exp(-pw(ang / aw, 2.0)) * swell;

  float close = h * smoothstep(aw, aw + 0.30, ang);

  float v = fbm3(vec2(th * uRays, r * 0.9 - t * 2.4));
  v += 0.50 * vnoise(vec2(th * uRays * 2.4 + 3.0, r * 1.8 - t * 3.6));
  v = pw(sat(v * 1.10 - 0.31), uContrast);

  v = mix(v, smoothstep(0.08, 0.50, v), 0.60 * sat(open));
  float env = exp(-pw(max(r - 0.30, 0.0) * uFall, 1.5));
  float aen = exp(-pw(abs(th) / max(uSweep, 0.05), 2.0));

  float body = v * env * aen * (1.0 + 0.90 * open) * (1.0 - 0.55 * close);
  float bloom = exp(-pw(max(r - 0.18, 0.0) * uFall * 1.30, 1.7)) * aen * (1.0 + 0.25 * open);
  vec3 col = uBg;
  col += uBase * bloom * 0.90;
  col += mix(uBase, uAccent, sat(body * 1.6)) * body * 2.4;
  col += uHigh * pw(sat(body - 0.38), 2.0) * 1.10;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

  // Original component defaults + the Originkit preset props.
  const PRESET = {
    background: "#000206",
    baseColor: "#3D00FF",
    accentColor: "#6EABF5",
    highlight: "#CFE4FF",
    density: 42,
    speed: 50,
    hover: 63,
    direction: "bottom",
    shaft: { sweep: 85, falloff: 150, aperture: 5, contrast: 150 },
  };

  const SHAFT_DEFAULTS = { contrast: 150, sweep: 85, falloff: 150, aperture: 22 };
  const DIRECTION_ANGLES = { top: 180, right: 90, bottom: 0, left: -90 };

  const parseColor = (input, fb) => {
    if (!input) return fb;
    const str = String(input).trim();
    if (str.charAt(0) === "#") {
      let hex = str.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r / 255, g / 255, b / 255];
      }
      return fb;
    }
    const m = str.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      return [
        Math.min(255, parseFloat(m[0])) / 255,
        Math.min(255, parseFloat(m[1])) / 255,
        Math.min(255, parseFloat(m[2])) / 255,
      ];
    }
    return fb;
  };

  const num = (v, fb) => (typeof v === "number" && isFinite(v) ? v : fb);
  const clampN = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  const compile = (gl, type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error("RayColumn shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };

  const start = () => {
    const container = document.querySelector(".site-background");
    if (!container || container.dataset.rayBound) return !!container;
    container.dataset.rayBound = "1";

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl =
      canvas.getContext("webgl", { antialias: false, alpha: false, depth: false }) ||
      canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false });
    if (!gl) {
      console.error("RayColumn: WebGL unavailable");
      return true;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return true;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("RayColumn link:", gl.getProgramInfoLog(prog));
      return true;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const locs = {};
    const u = (name) => {
      if (!(name in locs)) locs[name] = gl.getUniformLocation(prog, name);
      return locs[name];
    };

    // Props exactly as in the original component (preset applied).
    const v = {
      background: PRESET.background,
      baseColor: PRESET.baseColor,
      accentColor: PRESET.accentColor,
      highlight: PRESET.highlight,
      density: clampN(num(PRESET.density, 42), 10, 150) / 10,
      speed: clampN(num(PRESET.speed, 50), 0, 100) / 50,
      hover: clampN(num(PRESET.hover, 100), 0, 200) / 100,
      direction: ((DIRECTION_ANGLES[PRESET.direction] ?? 0) * Math.PI) / 180,
      contrast: clampN(num(PRESET.shaft.contrast, 150), 50, 400) / 100,
      sweep: clampN(num(PRESET.shaft.sweep, 85), 20, 200) / 100,
      falloff: clampN(num(PRESET.shaft.falloff, 150), 30, 400) / 100,
      aperture: clampN(num(PRESET.shaft.aperture, 22), 5, 90) / 100,
    };

    const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, on: 0, onTarget: 0 };

    // Pointer tracking on the window: the canvas sits behind the UI
    // (pointer-events:none), so listen above it — same values as original.
    const track = (e) => {
      ptr.tx = clampN(e.clientX / window.innerWidth, 0, 1);
      ptr.ty = clampN(e.clientY / window.innerHeight, 0, 1);
      ptr.onTarget = 1;
    };
    const onLeave = () => {
      ptr.onTarget = 0;
    };
    window.addEventListener("pointermove", track);
    window.addEventListener("pointerleave", onLeave);
    document.addEventListener("mouseleave", onLeave);

    let raf = 0;
    let last = performance.now();
    let clock = 0;

    const render = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      clock = (clock + dt * v.speed) % 3600;

      const k = 1 - Math.exp(-6 * dt);
      ptr.on += (ptr.onTarget - ptr.on) * k;
      ptr.x += ((ptr.onTarget > 0 ? ptr.tx : 0.5) - ptr.x) * k;
      ptr.y += ((ptr.onTarget > 0 ? ptr.ty : 0.5) - ptr.y) * k;

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const cw = canvas.clientWidth || window.innerWidth || 1200;
      const ch = canvas.clientHeight || window.innerHeight || 800;
      const bw = Math.max(1, Math.round(cw * dpr));
      const bh = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);

      gl.uniform2f(u("uRes"), bw, bh);
      gl.uniform1f(u("uTime"), clock);
      gl.uniform2f(u("uMouse"), ptr.x, 1 - ptr.y);
      gl.uniform1f(u("uHover"), Math.min(1, ptr.on) * v.hover);
      const c_uBg = parseColor(v.background, [0.0, 0.008, 0.024]);
      gl.uniform3f(u("uBg"), c_uBg[0], c_uBg[1], c_uBg[2]);
      const c_uBase = parseColor(v.baseColor, [0.063, 0.188, 0.431]);
      gl.uniform3f(u("uBase"), c_uBase[0], c_uBase[1], c_uBase[2]);
      const c_uAccent = parseColor(v.accentColor, [0.431, 0.671, 0.961]);
      gl.uniform3f(u("uAccent"), c_uAccent[0], c_uAccent[1], c_uAccent[2]);
      const c_uHigh = parseColor(v.highlight, [0.812, 0.894, 1.0]);
      gl.uniform3f(u("uHigh"), c_uHigh[0], c_uHigh[1], c_uHigh[2]);
      gl.uniform1f(u("uRays"), v.density);
      gl.uniform1f(u("uContrast"), v.contrast);
      gl.uniform1f(u("uSweep"), v.sweep);
      gl.uniform1f(u("uFall"), v.falloff);
      gl.uniform1f(u("uAper"), v.aperture);
      gl.uniform1f(u("uDirection"), v.direction);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    console.info("[raycolumn] Ray Column background running");
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
        console.warn("[raycolumn] .site-background never appeared");
      }
    }, 120);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
