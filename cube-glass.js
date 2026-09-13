// UNAL Market — Liquid Glass Cube (Originkit), faithful vanilla port.
// Body geometry (superellipsoid displacement), glass shaders (refraction,
// dispersion, gloss), preset values, and drag interaction unchanged from the
// provided component; three.js replaced by vanilla WebGL. The widget title
// and subtitle are painted on all 6 faces of the environment map, so the
// glass refracts the same wording on every face.
(() => {
  "use strict";

  const PERSPECTIVE = 0.15;
  const MAX_DPR = 2;

  const DEFAULTS = {
    glass: "#FFFFFF",
    roomTop: "#FFFFFF",
    roomBottom: "#FFFFFF",
    highlight: "#FFC500",
    rounding: 15,
    refraction: 20,
    dispersion: 20,
    clarity: 20,
    edge: 20,
    gloss: 20,
    speed: 5,
    direction: "right",
    dragSensitivity: 3,
    sizePercent: 100,
  };

  const clamp = (v, lo, hi, fallback) => {
    const n = typeof v === "number" && isFinite(v) ? v : fallback;
    return Math.max(lo, Math.min(hi, n));
  };

  const settingsFor = (cfg) => ({
    exponent:
      2 +
      Math.pow(1 - clamp(cfg.rounding, 0, 20, DEFAULTS.rounding) / 20, 1.6) * 48,
    ior: 1.05 + clamp(cfg.refraction, 1, 20, DEFAULTS.refraction) * 0.042,
    dispersion: clamp(cfg.dispersion, 0, 20, DEFAULTS.dispersion) * 0.004,
    clarity: clamp(cfg.clarity, 1, 20, DEFAULTS.clarity) / 20,
    edge: clamp(cfg.edge, 1, 20, DEFAULTS.edge) * 0.09,
    gloss: 20 + clamp(cfg.gloss, 1, 20, DEFAULTS.gloss) * 34,
    speed: clamp(cfg.speed, 0, 20, DEFAULTS.speed) * 0.09,
    heading: cfg.direction === "left" ? -1 : 1,
  });

  const hexToRgb = (hex) => {
    const h = (hex || "#ffffff").replace("#", "");
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    const int = parseInt(full, 16);
    if (!isFinite(int)) return [1, 1, 1];
    return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
  };

  // ---------- shaders (unchanged math) ------------------------------------
  const GLASS_VERTEX = `
    attribute vec3 aPos;
    attribute vec3 aNormal;
    uniform mat4 uProj, uView, uModel;
    uniform mat3 uNormalMat;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec4 world = uModel * vec4(aPos, 1.0);
      vec4 mv = uView * world;
      vNormal = normalize(uNormalMat * aNormal);
      vView = -mv.xyz;
      gl_Position = uProj * mv;
    }
  `;

  const GLASS_FRAGMENT = `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;

    uniform vec3 uGlass;
    uniform vec3 uRoomTop;
    uniform vec3 uRoomBottom;
    uniform vec3 uHighlight;
    uniform float uIor;
    uniform float uDispersion;
    uniform float uClarity;
    uniform float uEdge;
    uniform float uGloss;
    uniform sampler2D uRoomMap;   // 3x2 cross env map: widget text on all 6 faces

    varying vec3 vNormal;
    varying vec3 vView;

    const vec3 KEY = vec3(0.55, 0.72, 0.42);
    const vec3 FILL = vec3(-0.62, -0.28, 0.73);

    // Cube-face lookup for the cross layout:
    //   column 0: +X   column 1: +Y(top)/-Y(bottom)   column 2: +Z
    //   (rows: top half = upper faces, bottom half = lower faces)
    // Cell size is 1/3 x 1/2 of the texture. Text is painted identically on
    // every cell, so any refracted direction lands on the same wording.
    vec2 faceUv(vec3 d) {
      vec3 a = abs(d);
      vec2 uv;
      float col;
      if (a.x >= a.y && a.x >= a.z) {
        // +/-X faces
        col = 0.0;
        uv = vec2(d.z / a.x, -d.y / a.x);
      } else if (a.y >= a.z) {
        // +/-Y faces
        col = 1.0;
        uv = vec2(d.x / a.y, d.z / a.y);
      } else {
        // +/-Z faces
        col = 2.0;
        uv = vec2(d.x / a.z, -d.y / a.z);
      }
      uv = uv * 0.5 + 0.5;
      uv.x = (col + uv.x) / 3.0;
      uv.y = uv.y * 0.5;
      return uv;
    }

    vec3 room(vec3 dir) {
      vec3 base = texture2D(uRoomMap, faceUv(dir)).rgb;
      float key = pow(max(dot(dir, normalize(KEY)), 0.0), 28.0);
      float fill = pow(max(dot(dir, normalize(FILL)), 0.0), 12.0);
      return base + uHighlight * (key * 1.6 + fill * 0.35);
    }

    void main() {
      vec3 n = normalize(vNormal);
      vec3 v = normalize(vView);

      if (!gl_FrontFacing) n = -n;
      float facing = gl_FrontFacing ? 1.0 : 0.45;

      float f = clamp(pow(1.0 - max(dot(n, v), 0.0), 5.0), 0.0, 1.0);
      float rim = clamp(f * uEdge, 0.0, 1.0);

      vec3 reflected = room(reflect(-v, n));

      float eta = 1.0 / max(1.001, uIor);
      vec3 rRay = refract(-v, n, eta * (1.0 + uDispersion));
      vec3 gRay = refract(-v, n, eta);
      vec3 bRay = refract(-v, n, eta * (1.0 - uDispersion));
      vec3 refracted = vec3(room(rRay).r, room(gRay).g, room(bRay).b);

      vec3 tinted = mix(refracted, refracted * uGlass, 1.0 - uClarity);

      vec3 col = mix(tinted, reflected, rim);

      float face = smoothstep(-0.35, 0.9, dot(n, normalize(KEY)));
      col *= 0.72 + face * 0.55;

      vec3 hKey = normalize(normalize(KEY) + v);
      vec3 hFill = normalize(normalize(FILL) + v);
      float spec =
        pow(max(dot(n, hKey), 0.0), uGloss) * 1.35 +
        pow(max(dot(n, hFill), 0.0), uGloss * 0.35) * 0.5 +
        pow(max(dot(n, hKey), 0.0), 6.0) * 0.12;
      col += uHighlight * spec * facing;

      float alpha = 0.05 + rim * 0.85 + clamp(spec, 0.0, 1.0) * 0.75;
      alpha += (1.0 - uClarity) * 0.16;

      alpha += face * 0.1;
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0) * facing);
    }
  `;

  // ---------- geometry: superellipsoid exactly like buildBody() -----------
  const buildBody = (exponent) => {
    const stacks = 96;
    const slices = 128;
    const positions = [];
    const normals = [];
    const indices = [];
    const n = Math.max(2, exponent);

    const sgn = (x) => (x < 0 ? -1 : 1);

    for (let i = 0; i <= stacks; i++) {
      const phi = (i / stacks) * Math.PI;
      for (let j = 0; j <= slices; j++) {
        const theta = (j / slices) * Math.PI * 2;
        const sx = Math.sin(phi) * Math.cos(theta);
        const sy = Math.cos(phi);
        const sz = Math.sin(phi) * Math.sin(theta);
        const d =
          Math.pow(Math.abs(sx), n) + Math.pow(Math.abs(sy), n) + Math.pow(Math.abs(sz), n);
        const r = Math.pow(d, -1 / n);
        const x = sx * r;
        const y = sy * r;
        const z = sz * r;
        positions.push(x, y, z);
        // Normal from the implicit surface gradient: (n*|x|^(n-1)*sgn(x), ...)
        const e = 1e-4;
        const gx = sgn(x) * Math.pow(Math.max(Math.abs(x), e), n - 1);
        const gy = sgn(y) * Math.pow(Math.max(Math.abs(y), e), n - 1);
        const gz = sgn(z) * Math.pow(Math.max(Math.abs(z), e), n - 1);
        const len = Math.hypot(gx, gy, gz) || 1;
        normals.push(gx / len, gy / len, gz / len);
      }
    }
    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < slices; j++) {
        const a = i * (slices + 1) + j;
        const b = a + slices + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint16Array(indices),
    };
  };

  // ---------- env map: gradient + widget text on ALL 6 faces --------------
  const buildRoomTexture = (gl, title, sub) => {
    const F = 512; // face size in px
    const c = document.createElement("canvas");
    c.width = F * 3;
    c.height = F * 2;
    const ctx = c.getContext("2d");

    // 6 cells of the 3x2 cross; every cell gets the same paint so the
    // wording shows on every cube face (top, bottom, and 4 sides).
    const cells = [];
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) cells.push([col * F, row * F]);

    for (const [px, py] of cells) {
      // Room gradient: dark navy floor -> blue ceiling (roomBottom -> roomTop)
      const g = ctx.createLinearGradient(0, py + F, 0, py);
      g.addColorStop(0, "#081027");
      g.addColorStop(1, "#1d46b8");
      ctx.fillStyle = g;
      ctx.fillRect(px, py, F, F);

      // Subtle face vignette for depth inside the glass
      const rg = ctx.createRadialGradient(px + F / 2, py + F / 2, F * 0.1, px + F / 2, py + F / 2, F * 0.75);
      rg.addColorStop(0, "rgba(255,255,255,0.06)");
      rg.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = rg;
      ctx.fillRect(px, py, F, F);

      ctx.save();
      ctx.translate(px, py);

      // Title — stacked words, big and bold
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      const words = String(title).trim().split(/\s+/);
      const lines = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (test.length > 10 && cur) { lines.push(cur); cur = w; } else { cur = test; }
      }
      lines.push(cur);
      const fontSize = lines.length > 1 ? 88 : 112;
      ctx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
      const startY = F * 0.40 - (lines.length - 1) * fontSize * 0.55;
      lines.forEach((ln, k) => {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 8;
        ctx.fillText(ln, F / 2, startY + k * fontSize * 1.1, F * 0.92);
      });

      // Divider
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,197,0,0.9)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(F * 0.3, F * 0.615);
      ctx.lineTo(F * 0.7, F * 0.615);
      ctx.stroke();

      // Subtitle — wrapped
      ctx.font = "700 36px Arial, Helvetica, sans-serif";
      ctx.fillStyle = "rgba(228,240,255,0.95)";
      const subWords = String(sub).trim().split(/\s+/);
      const subLines = [];
      cur = "";
      for (const w of subWords) {
        const test = cur ? cur + " " + w : w;
        if (test.length > 16 && cur) { subLines.push(cur); cur = w; } else { cur = test; }
      }
      subLines.push(cur);
      subLines.forEach((ln, k) =>
        ctx.fillText(ln, F / 2, F * 0.73 + k * 46, F * 0.88),
      );

      ctx.restore();
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    // NPOT texture: clamp + no mipmaps (WebGL1 requirement).
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  };

  // ---------- scene --------------------------------------------------------
  const createCube = (container) => {
    const title = container.dataset.cubeTitle || "UNAL";
    const sub = container.dataset.cubeSub || "";

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    const gl =
      canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true }) ||
      canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) {
      console.warn("[cube] WebGL unavailable for", title);
      return null;
    }
    gl.getExtension("GL_OES_standard_derivatives");

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("[cube] shader:", gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, GLASS_VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, GLASS_FRAGMENT);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[cube] link:", gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    const cfg = { ...DEFAULTS };
    const S = settingsFor(cfg);

    const geo = buildBody(S.exponent);
    const vboP = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboP);
    gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    const vboN = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vboN);
    gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);
    const aNor = gl.getAttribLocation(prog, "aNormal");
    gl.enableVertexAttribArray(aNor);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 0, 0);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
    const indexCount = geo.indices.length;

    const tex = buildRoomTexture(gl, title, sub);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, "uRoomMap"), 0);

    const U = (n2) => gl.getUniformLocation(prog, n2);
    const u = {
      uProj: U("uProj"),
      uView: U("uView"),
      uModel: U("uModel"),
      uNormalMat: U("uNormalMat"),
      uGlass: U("uGlass"),
      uRoomTop: U("uRoomTop"),
      uRoomBottom: U("uRoomBottom"),
      uHighlight: U("uHighlight"),
      uIor: U("uIor"),
      uDispersion: U("uDispersion"),
      uClarity: U("uClarity"),
      uEdge: U("uEdge"),
      uGloss: U("uGloss"),
    };

    const set3 = (loc, rgb) => gl.uniform3f(loc, rgb[0], rgb[1], rgb[2]);
    set3(u.uGlass, hexToRgb(cfg.glass));
    set3(u.uRoomTop, hexToRgb(cfg.roomTop));
    set3(u.uRoomBottom, hexToRgb(cfg.roomBottom));
    set3(u.uHighlight, hexToRgb(cfg.highlight));
    gl.uniform1f(u.uIor, S.ior);
    gl.uniform1f(u.uDispersion, S.dispersion);
    gl.uniform1f(u.uClarity, S.clarity);
    gl.uniform1f(u.uEdge, S.edge);
    gl.uniform1f(u.uGloss, S.gloss);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    // Matrices (column-major), mirroring the original camera math.
    const mat4Identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    const perspective = (fovy, aspect, near, far) => {
      const f = 1 / Math.tan(fovy / 2);
      const nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
      ]);
    };

    const distance = 1 / PERSPECTIVE;
    const view = mat4Identity();
    view[14] = -distance; // camera at (0, 0, distance) looking at origin

    let proj = perspective(1, 1, Math.max(0.1, distance - 20), distance + 20);

    const updateCamera = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      const aspect = w / h;
      const sizePct = clamp(cfg.sizePercent, 20, 200, 85);
      const span = 3.1 * (100 / sizePct);
      const visibleHeight = aspect < 1 ? span / aspect : span;
      const fovy = 2 * Math.atan(visibleHeight / 2 / distance);
      proj = perspective(fovy, aspect, Math.max(0.1, distance - 20), distance + 20);
    };

    const mat3FromMat4 = (m) =>
      new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);

    const rotYX = (ry, rx) => {
      const cy = Math.cos(ry), sy = Math.sin(ry);
      const cx = Math.cos(rx), sx = Math.sin(rx);
      // R = Rx * Ry (yaw then pitch), column-major
      return new Float32Array([
        cy, sx * sy, -cx * sy, 0,
        0, cx, sx, 0,
        sy, -sx * cy, cx * cy, 0,
        0, 0, 0, 1,
      ]);
    };

    // drag interaction (same feel as original)
    let spinAngle = 0, dragX = 0, dragY = 0, velX = 0, velY = 0;
    let isDragging = false, lastX = 0, lastY = 0;
    const down = (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      velX = 0; velY = 0;
      canvas.style.cursor = "grabbing";
    };
    const move = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const s = clamp(cfg.dragSensitivity, 0, 10, 3) * 0.007;
      dragY += dx * s;
      dragX += dy * s;
      velY = dx * s;
      velX = dy * s;
    };
    const up = () => {
      isDragging = false;
      canvas.style.cursor = "grab";
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.max(1, Math.round(container.clientWidth * dpr));
      const h = Math.max(1, Math.round(container.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      updateCamera();
    };
    resize();
    new ResizeObserver(resize).observe(container);

    let lastT = performance.now();
    const loop = () => {
      const now = performance.now();
      let dt = (now - lastT) / 1000;
      lastT = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > 0.05) dt = 0.05;

      if (!isDragging) {
        const decay = Math.exp(-dt * 3);
        dragY += velY;
        dragX += velX;
        velX *= decay;
        velY *= decay;
        spinAngle += S.speed * S.heading * dt;
      }

      const model = rotYX(spinAngle + dragY, clamp(dragX * 0.5, -0.9, 0.9));

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix4fv(u.uProj, false, proj);
      gl.uniformMatrix4fv(u.uView, false, view);
      gl.uniformMatrix4fv(u.uModel, false, model);
      gl.uniformMatrix3fv(u.uNormalMat, false, mat3FromMat4(model));
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    console.info("[cube] Liquid Glass Cube running:", title);
    return true;
  };

  const boot = () => {
    const bind = () => {
      const hosts = document.querySelectorAll(".liquid-cube:not([data-bound])");
      hosts.forEach((h) => {
        h.dataset.bound = "1";
        createCube(h);
      });
      return document.querySelectorAll(".liquid-cube[data-bound]").length;
    };
    if (bind() >= 2) return;
    const began = performance.now();
    const poll = setInterval(() => {
      const bound = bind();
      if (bound >= 2 || performance.now() - began > 15000) clearInterval(poll);
    }, 150);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
