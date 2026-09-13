// UNAL Market — Fluid Ribbons background (Originkit), faithful vanilla port.
// The React wrapper became plain JS; shaders, defaults, colors, uniforms and
// timing formulas are unchanged from the provided component.
(() => {
  "use strict";

  const MAX_STOPS = 9;

  const DEFAULT_FIELD = {
    focalX: -16,
    focalY: -10,
    filaments: 8.5,
    fan: -7.8,
    density: 5,
  };

  const DEFAULT_RIBBON = {
    width: 5,
    glow: 5,
    intensity: 5,
    opacity: 100,
  };

  const DEFAULTS = {
    colors: [
      "#0A0430",
      "#1E10A8",
      "#4B22E8",
      "#7B27D8",
      "#C0208A",
      "#F0231F",
      "#FF6A28",
      "#FFB98A",
      "#FFF0E4",
    ],
    background: "#0A0430",
    warp: 5.8,
    speed: 2.9,
    paused: false,
    interaction: 0,
  };

  const LOOP_SECONDS = 2.3333;

  const DPR_CAP = 1.75;

  const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;

void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  const FRAG = `#version 300 es
precision highp float;

#define MAX_STOPS ${MAX_STOPS}

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uColors[MAX_STOPS];
uniform int   uCount;
uniform vec3  uBg;
uniform float uSpeed;
uniform float uWarp;
uniform float uFan;
uniform float uFilaments;
uniform float uWidth;
uniform float uGlow;
uniform float uIntensity;
uniform vec2  uFocal;
uniform float uOpacity;
uniform float uDensity;

const float TAU = 6.28318530718;
const float LOOP_SECONDS = ${LOOP_SECONDS};

const float DIAG    = -0.9599;
const float SQUASH  = 0.52;
const float LENS    = 0.62;
const float LENS_R  = 1.0;
const float LENS2   = 0.22;
const float LENS2_R = 1.9;
const vec2  LENS2_P = vec2(0.9, 0.5);
const float WEDGE   = 0.7679;
const float CROSS   = 0.6;
const float SWELL   = 0.32;
const float COUNT_B = 0.6875;

float hash(vec2 p) {
    return fract(sin(p.x * 127.1 + p.y * 311.7) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return (a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y)
           * 2.0 - 1.0;
}

const mat2 FBM_ROT = mat2(1.36, 1.02, -1.02, 1.36);

float fbm(vec2 p, int octaves) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
        if (i >= octaves) break;
        v += amp * noise(p);
        p = FBM_ROT * p;
        amp *= 0.5;
    }
    return v;
}

vec2 domainWarp(vec2 p, float phase, float strength) {
    vec2 c1 = 0.60 * vec2(cos(phase), sin(phase));
    p += strength * 0.30 * vec2(
        fbm(p * 0.55 * uDensity + c1, 3),
        fbm(p * 0.55 * uDensity + vec2(4.3, -2.1) + c1.yx * vec2(1.0, -1.0), 3)
    );

    vec2 c2 = 0.90 * vec2(cos(phase + 2.1), sin(phase + 2.1));
    p += strength * 0.07 * vec2(
        fbm(p * 1.4 * uDensity + c2, 2),
        fbm(p * 1.4 * uDensity + vec2(-3.7, 1.9) + c2.yx * vec2(1.0, -1.0), 2)
    );
    return p;
}

vec2 lensMagnify(vec2 p) {
    float m = 1.0 + LENS * exp(-dot(p, p) / (LENS_R * LENS_R));
    vec2 o = p - LENS2_P;
    m *= 1.0 + LENS2 * exp(-dot(o, o) / (LENS2_R * LENS2_R));
    return p * m;
}

float fanPhase(vec2 p, float count, float spread, float wobble) {
    return count * p.x * (1.0 + spread * tanh(p.y * 0.55)) + wobble;
}

float ribbonIntensity(float phase, float width) {
    float d = abs(sin(phase)) / max(width, 0.05);
    return exp(-d * d * 2.1) + exp(-d * d * 40.0) * 0.35;
}

vec3 colorRamp(float t) {
    float span = float(uCount - 1);
    if (span < 0.5) return uColors[0];

    float u = clamp(t, 0.0, 1.0) * span;
    int i = int(min(floor(u), span - 1.0));
    float k = clamp(u - float(i), 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    return mix(uColors[i], uColors[i + 1], k);
}

vec3 bloomContribution(float v) {
    float over = max(v - 1.05, 0.0);
    return vec3(1.0, 0.86, 0.74) * (over * over * 0.55);
}

void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p *= vec2(max(uResolution.x / uResolution.y, 1.0),
              max(uResolution.y / uResolution.x, 1.0));

    float phase = TAU * uTime * uSpeed / LOOP_SECONDS;

    vec2 q = p - uFocal;
    float dc = cos(DIAG), ds = sin(DIAG);
    vec2 e = vec2(dc * q.x + ds * q.y, (-ds * q.x + dc * q.y) / SQUASH);

    e = domainWarp(e, phase, uWarp);
    e = lensMagnify(e);

    float r = length(e);

    float cw = cos(WEDGE * 0.5), sw = sin(WEDGE * 0.5);
    vec2 fa = vec2(cw * e.x + sw * e.y, -sw * e.x + cw * e.y);
    vec2 fb = vec2(cw * e.x - sw * e.y,  sw * e.x + cw * e.y);

    float phA = fanPhase(fa, uFilaments, uFan,
                         0.55 * sin(phase + fa.y * 0.8));
    float phB = fanPhase(fb, uFilaments * COUNT_B, -uFan * 0.7,
                         0.55 * sin(phase + 2.4 + fb.y * 0.7));

    float width = uWidth * (1.0 + 0.22 * fbm(e * 0.9 + vec2(9.1, -5.2), 2));

    float cross = CROSS / (1.0 + r * r * 1.6);

    float v = ribbonIntensity(phA, width)
            + ribbonIntensity(phB, width) * cross;
    v *= uGlow;

    v *= 0.7 + 0.5 / (1.0 + r * r * 1.2);

    float bn = fbm(e * 0.32 * uDensity + vec2(-2.3, 6.7)
                   + 0.35 * vec2(cos(phase), sin(phase)), 2);
    float swell = SWELL * smoothstep(-0.06, 0.40, bn);

    float energy = (v + swell) * uIntensity;
    vec3 col = colorRamp(energy) + bloomContribution(energy * 1.6);

    col += uBg * (1.0 - smoothstep(0.0, 0.30, energy));

    col *= 1.0 - 0.25 * min(1.0, dot(p, p) * 0.35);

    fragColor = vec4(clamp(col, 0.0, 1.0), uOpacity);
}
`;

  function toRGB(css) {
    if (!css) return [0, 0, 0];
    const s = String(css).trim();

    const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (hex) {
      let h = hex[1];
      if (h.length === 3 || h.length === 4) {
        h = h.split("").map((c) => c + c).join("");
      }
      const n = parseInt(h.slice(0, 6), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }

    const fn = /^rgba?\(([^)]+)\)$/i.exec(s);
    if (fn) {
      const parts = fn[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
      const v = parts.map((x) =>
        x.indexOf("%") >= 0 ? parseFloat(x) * 2.55 : parseFloat(x)
      );
      return [(v[0] || 0) / 255, (v[1] || 0) / 255, (v[2] || 0) / 255];
    }
    return [0, 0, 0];
  }

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("FluidRibbons shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function start(host) {
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    host.appendChild(canvas);

    let gl = null;
    let program = null;
    let buffer = null;
    let vao = null;
    let uni = {};

    let onScreen = true;
    let pageVisible = true;
    let pointerTX = 0;
    let pointerTY = 0;
    let pointerX = 0;
    let pointerY = 0;

    let elapsed = 0;
    let lastNow = 0;

    const colorBuf = new Float32Array(MAX_STOPS * 3);

    function init() {
      const ctx = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      });
      if (!ctx) return false;
      gl = ctx;

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;

      const prog = gl.createProgram();
      if (!prog) return false;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.bindAttribLocation(prog, 0, "aPos");
      gl.linkProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;

      program = prog;
      gl.useProgram(prog);

      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const names = [
        "uTime",
        "uResolution",
        "uColors[0]",
        "uCount",
        "uBg",
        "uSpeed",
        "uWarp",
        "uFan",
        "uFilaments",
        "uWidth",
        "uGlow",
        "uIntensity",
        "uFocal",
        "uOpacity",
        "uDensity",
      ];
      uni = {};
      for (const n of names) uni[n] = gl.getUniformLocation(prog, n);

      gl.clearColor(0, 0, 0, 0);
      return true;
    }

    function resize() {
      if (!gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function draw(dt) {
      if (!gl || !program) return;
      const f = DEFAULT_FIELD;
      const rb = DEFAULT_RIBBON;

      const damp = 1 - Math.exp(-dt * 6);
      pointerX += (pointerTX - pointerX) * damp;
      pointerY += (pointerTY - pointerY) * damp;

      const rate = DEFAULTS.speed * 0.2;

      const frozen = DEFAULTS.paused;
      if (!frozen && rate > 0) {
        elapsed = (elapsed + dt) % (LOOP_SECONDS / rate);
      }

      const list = DEFAULTS.colors.slice(0, MAX_STOPS);
      colorBuf.fill(0);
      for (let i = 0; i < list.length; i++) {
        const c = toRGB(list[i]);
        colorBuf[i * 3] = c[0];
        colorBuf[i * 3 + 1] = c[1];
        colorBuf[i * 3 + 2] = c[2];
      }
      const bg = toRGB(DEFAULTS.background);

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform1f(uni["uTime"], elapsed);
      gl.uniform2f(uni["uResolution"], canvas.width, canvas.height);
      gl.uniform3fv(uni["uColors[0]"], colorBuf);
      gl.uniform1i(uni["uCount"], Math.max(1, list.length));
      gl.uniform3f(uni["uBg"], bg[0], bg[1], bg[2]);
      gl.uniform1f(uni["uSpeed"], rate);
      gl.uniform1f(uni["uWarp"], DEFAULTS.warp * 0.2);
      gl.uniform1f(uni["uDensity"], 0.4 + f.density * 0.12);
      gl.uniform1f(uni["uFan"], f.fan * 0.1);
      gl.uniform1f(uni["uFilaments"], f.filaments);
      gl.uniform1f(uni["uWidth"], 0.35 + rb.width * 0.13);
      gl.uniform1f(uni["uGlow"], rb.glow * 0.2);
      gl.uniform1f(uni["uIntensity"], rb.intensity * 0.156);
      const interactionAmt = DEFAULTS.interaction * 0.006;
      gl.uniform2f(
        uni["uFocal"],
        f.focalX / 100 + pointerX * interactionAmt,
        f.focalY / 100 + pointerY * interactionAmt
      );
      gl.uniform1f(
        uni["uOpacity"],
        Math.max(0, Math.min(1, rb.opacity / 100))
      );

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!onScreen || !pageVisible) {
        lastNow = now;
        return;
      }
      const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0;
      lastNow = now;
      resize();
      draw(dt);
    }

    if (!init()) {
      // Same fallback as the original failed state.
      canvas.style.background =
        "linear-gradient(115deg, " +
        DEFAULTS.colors.concat(DEFAULTS.colors.slice().reverse()).join(", ") +
        ")";
      canvas.style.filter = "blur(40px) saturate(1.3)";
      console.warn("[fluid-ribbons] WebGL2 unavailable — gradient fallback");
      return false;
    }

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resize())
        : null;
    if (ro) ro.observe(host);

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              onScreen = entries.some((e) => e.isIntersecting);
            },
            { rootMargin: "128px" }
          )
        : null;
    if (io) io.observe(host);

    const onVisibility = () => {
      pageVisible = document.visibilityState !== "hidden";
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPointerMove = (e) => {
      const rect = host.getBoundingClientRect();
      pointerTX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerTY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    const onPointerLeave = () => {
      pointerTX = 0;
      pointerTY = 0;
    };
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);

    let raf = 0;

    const onLost = (e) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    };
    const onRestored = () => {
      lastNow = 0;
      if (init()) raf = requestAnimationFrame(loop);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    resize();
    raf = requestAnimationFrame(loop);
    console.info("[fluid-ribbons] Fluid Ribbons background running (WebGL2)");
    return true;
  }

  // .site-background is created by React after boot — poll until it exists.
  function boot() {
    const bg = document.querySelector(".site-background");
    if (bg) {
      const host = document.createElement("div");
      host.className = "fluid-ribbons-host";
      bg.insertBefore(host, bg.firstChild);
      host.style.position = "absolute";
      host.style.inset = "0";
      start(host);
      return;
    }
    const began = performance.now();
    const poll = setInterval(() => {
      const b = document.querySelector(".site-background");
      if (b) {
        clearInterval(poll);
        const host = document.createElement("div");
        host.className = "fluid-ribbons-host";
        b.insertBefore(host, b.firstChild);
        host.style.position = "absolute";
        host.style.inset = "0";
        start(host);
      } else if (performance.now() - began > 15000) {
        clearInterval(poll);
        console.warn("[fluid-ribbons] .site-background never appeared");
      }
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
