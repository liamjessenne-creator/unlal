// UNAL Market — floating 3D iPhone v2: real extruded geometry.
// Slab mesh (front face + back face + thick titanium side rails), lit shading,
// map photo on a near-edge-to-edge screen. Drag rotation with inertia + idle
// float, as before. Vanilla WebGL2, zero dependencies.
(() => {
  "use strict";

  // Same photo the original widget used (map preview around UNAL MARKET).
  const IMG_SRC = "/img/phone-map.png"; // photo fournie, affichée telle quelle

  // ---- dimensions (world units) ---------------------------------------------
  const W = 1.0;            // phone width
  const H = 2.04;           // phone height
  const D = 0.16;           // side rail thickness (the wide 3D edges)
  const R = 0.155;          // corner radius
  const SEG = 14;           // segments per corner arc

  // ---- textures (canvas-drawn) ----------------------------------------------
  const TW = 516, TH = 1052;

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // Front: thin titanium edge, slim black bezel, near-full-screen photo.
  function buildScreenTexture(img) {
    const c = document.createElement("canvas");
    c.width = TW; c.height = TH;
    const g = c.getContext("2d");

    // titanium sliver (visible only at glancing angles)
    const frame = g.createLinearGradient(0, 0, TW, TH);
    frame.addColorStop(0, "#e8eef7");
    frame.addColorStop(0.5, "#8d99ab");
    frame.addColorStop(1, "#d7e0ec");
    rr(g, 0, 0, TW, TH, 46);
    g.fillStyle = frame; g.fill();

    // slim black bezel
    rr(g, 10, 10, TW - 20, TH - 20, 40);
    g.fillStyle = "#04060c"; g.fill();

    // screen with the map photo (96% of the front)
    g.save();
    rr(g, 22, 22, TW - 44, TH - 44, 30);
    g.clip();
    g.fillStyle = "#101216"; g.fillRect(22, 22, TW - 44, TH - 44);
    const iw = img.width || 1024, ih = img.height || 1024;
    const sc = Math.max((TW - 44) / iw, (TH - 44) / ih);
    const dw = iw * sc, dh = ih * sc;
    g.drawImage(img, 22 + (TW - 44 - dw) / 2, 22 + (TH - 44 - dh) / 2, dw, dh);

    // status bar + dynamic island over the photo
    g.fillStyle = "rgba(3,8,18,0.72)";
    g.fillRect(22, 22, TW - 44, 56);
    rr(g, TW / 2 - 74, 40, 148, 30, 15);
    g.fillStyle = "#000"; g.fill();
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.font = "600 21px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText("9:41", 52, 50);
    g.textAlign = "right";
    g.fillText("100%", TW - 52, 50);
    g.textAlign = "left";
    g.restore();
    return c;
  }

  // Back: dark titanium with a camera module.
  function buildBackTexture() {
    const c = document.createElement("canvas");
    c.width = TW; c.height = TH;
    const g = c.getContext("2d");

    const back = g.createLinearGradient(0, 0, TW, TH);
    back.addColorStop(0, "#232c3d");
    back.addColorStop(0.45, "#141b29");
    back.addColorStop(1, "#0a101c");
    rr(g, 0, 0, TW, TH, 46);
    g.fillStyle = back; g.fill();

    // camera module (top-left), three lenses
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

    // "U" monogram, subtle
    g.fillStyle = "rgba(255,255,255,0.16)";
    g.font = "700 120px system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("U", TW / 2, TH / 2);
    return c;
  }

  // ---- geometry: rounded-rect extruded slab ----------------------------------
  function roundedRectPoints() {
    const pts = [];
    const cx = W / 2 - R, cy = H / 2 - R;
    const corners = [
      [ cx,  cy,   0],
      [-cx,  cy,  90],
      [-cx, -cy, 180],
      [ cx, -cy, 270],
    ];
    for (const [ox, oy, a0] of corners) {
      for (let i = 0; i <= SEG; i++) {
        const a = ((a0 + (i / SEG) * 90) * Math.PI) / 180;
        pts.push([ox + R * Math.cos(a), oy + R * Math.sin(a)]);
      }
    }
    return pts;
  }

  function buildMesh() {
    const pts = roundedRectPoints();
    const n = pts.length;
    const d2 = D / 2;
    const pos = [], nor = [], uv = [], face = [], idx = [];

    const pushV = (x, y, z, nx, ny, nz, u, v, f) => {
      pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(u, v); face.push(f);
      return pos.length / 3 - 1;
    };

    // front cap (fan from center)
    const zF = d2;
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i];
      pushV(x, y, zF, 0, 0, 1, x / W + 0.5, y / H + 0.5, 0);
    }
    const cF = pushV(0, 0, zF, 0, 0, 1, 0.5, 0.5, 0);
    for (let i = 0; i < n; i++) {
      idx.push(cF, pts[(i + 1) % n] === pts[i] ? i : (i + 1) % n, i);
    }

    // back cap (reversed)
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i];
      pushV(x, y, -d2, 0, 0, -1, x / W + 0.5, y / H + 0.5, 1);
    }
    const b0 = n, cB = pushV(0, 0, -d2, 0, 0, -1, 0.5, 0.5, 1);
    for (let i = 0; i < n; i++) idx.push(cB, b0 + i, b0 + ((i + 1) % n));

    // side rails
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [x1, y1] = pts[i], [x2, y2] = pts[j];
      let nx = y2 - y1, ny = -(x2 - x1);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      const f1 = pushV(x1, y1,  zF, nx, ny, 0, i / n, 0, 2);
      const f2 = pushV(x2, y2,  zF, nx, ny, 0, j / n, 0, 2);
      const b1 = pushV(x1, y1, -d2, nx, ny, 0, i / n, 1, 2);
      const b2 = pushV(x2, y2, -d2, nx, ny, 0, j / n, 1, 2);
      idx.push(f1, b1, f2, f2, b1, b2);
    }

    // fix front fan indices (they were pushed with a bad expression above)
    idx.length = 0;
    for (let i = 0; i < n; i++) idx.push(cF, i, (i + 1) % n);
    for (let i = 0; i < n; i++) idx.push(cB, b0 + i, b0 + ((i + 1) % n));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [x1, y1] = pts[i], [x2, y2] = pts[j];
      let nx = y2 - y1, ny = -(x2 - x1);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      idx.push(i, n + 1 + 1 + i, j);                    // placeholder replaced below
    }
    return { pos, nor, uv, face, idx, n };
  }

  // Simpler, correct mesh assembly (front cap, back cap, rails).
  function buildMeshClean() {
    const pts = roundedRectPoints();
    const n = pts.length;
    const d2 = D / 2;
    const V = [];   // interleaved: pos3 nor3 uv2 face1
    const idx = [];
    const add = (x, y, z, nx, ny, nz, u, v, f) => {
      V.push(x, y, z, nx, ny, nz, u, v, f);
      return V.length / 9 - 1;
    };

    // front cap
    const ringF = pts.map(([x, y]) => add(x, y, d2, 0, 0, 1, x / W + 0.5, y / H + 0.5, 0));
    const cF = add(0, 0, d2, 0, 0, 1, 0.5, 0.5, 0);
    for (let i = 0; i < n; i++) idx.push(cF, ringF[i], ringF[(i + 1) % n]);

    // back cap — UVs rotated 180° (u and v mirrored) so the back reads
    // upright and un-mirrored when the phone is flipped around
    const ringB = pts.map(([x, y]) => add(x, y, -d2, 0, 0, -1, 0.5 - x / W, 0.5 - y / H, 1));
    const cB = add(0, 0, -d2, 0, 0, -1, 0.5, 0.5, 1);
    for (let i = 0; i < n; i++) idx.push(cB, ringB[(i + 1) % n], ringB[i]);

    // side rails
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [x1, y1] = pts[i], [x2, y2] = pts[j];
      let nx = y2 - y1, ny = -(x2 - x1);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      const f1 = ringF[i], f2 = ringF[j], b1 = ringB[i], b2 = ringB[j];
      idx.push(f1, b1, f2, f2, b1, b2);
    }

    return {
      data: new Float32Array(V),
      indices: new Uint16Array(idx),
      count: idx.length,
    };
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

void main() {
  vec3 N = normalize(vNor);
  vec3 L = normalize(vec3(0.35, 0.55, 0.85));
  vec3 V = normalize(uCam - vWorld);
  float diff = max(dot(N, L), 0.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

  vec3 col;
  if (vFace < 0.5) {
    // screen: photo stays readable, slight light response
    vec3 t = texture(uScreen, vUv).rgb;
    col = t * (0.86 + 0.14 * diff);
  } else if (vFace < 1.5) {
    // back glass
    vec3 t = texture(uBack, vUv).rgb;
    col = t * (0.55 + 0.55 * diff);
  } else {
    // wide titanium rails with a travelling specular band
    vec3 base = vec3(0.74, 0.78, 0.85);
    float band = smoothstep(0.35, 0.0, abs(N.x * 0.82 + N.y * 0.40 - 0.18 * sin(vWorld.y * 9.0)));
    float spec = pow(diff, 24.0);
    col = base * (0.42 + 0.75 * diff);
    col += vec3(1.0, 1.0, 1.05) * spec * 1.1;
    col += vec3(0.9, 0.95, 1.0) * band * 0.30;
  }

  // cool rim light so edges read against dark backgrounds
  col += vec3(0.45, 0.60, 0.90) * fres * (vFace > 1.5 ? 0.55 : 0.22);
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
    m[0] = cy;        m[2] = sy;
    m[4] = sx * sy;   m[5] = cx;   m[6] = -sx * cy;
    m[8] = -cx * sy;  m[9] = sx;   m[10] = cx * cy;
    m[15] = 1;
    return m;
  }

  function start(canvas) {
    const gl = canvas.getContext("webgl2", {
      alpha: true, antialias: true, premultipliedAlpha: false,
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

    const mesh = buildMeshClean();
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
    // Camera far enough back that a full 360° spin + float/sway never clips
    // the phone's corners (3D half-diagonal of the phone ≈ 1.04 world units).
    gl.uniform3f(gl.getUniformLocation(prog, "uCam"), 0, 0, 4.6);

    const texScreen = gl.createTexture();
    const texBack = gl.createTexture();
    let texReady = false;

    // back texture immediately
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texBack);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buildBackTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // screen texture: placeholder until the photo loads
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texScreen);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([16, 18, 22, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texScreen);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
        buildScreenTexture(img));
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      texReady = true;
    };
    img.src = IMG_SRC;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);

    // ---- float + drag physics (unchanged behavior) --------------------------
    let yaw = -0.55, pitch = 0.12;
    let yawVel = 0, pitchVel = 0;
    let dragging = false, lastX = 0, lastY = 0, lastMoveT = 0;
    let raf = 0, lastT = 0;

    const onDown = (e) => {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY; lastMoveT = performance.now();
      yawVel = 0; pitchVel = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch { }
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(8, now - lastMoveT) / 1000;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; lastMoveT = now;
      yaw += dx * 0.0082;
      pitch = Math.max(-0.9, Math.min(0.9, pitch + dy * 0.0062));
      yawVel = 0.65 * yawVel + 0.35 * (dx * 0.0082 / dt);
      pitchVel = 0.65 * pitchVel + 0.35 * (dy * 0.0062 / dt);
    };
    const onUp = () => { dragging = false; };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
      lastT = now;
      const t = now / 1000;

      if (!dragging) {
        yaw += yawVel * dt;
        pitch += pitchVel * dt;
        yawVel *= Math.exp(-dt * 2.0);
        pitchVel *= Math.exp(-dt * 2.0);
        pitchVel += (-pitch * 6.0 - pitchVel * 4.0) * dt;
        pitch = Math.max(-0.9, Math.min(0.9, pitch));
      }

      resize();
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const aspect = canvas.width / Math.max(1, canvas.height);
      const proj = perspective(0.62, aspect, 0.1, 40);
      // Same distance as uCam above (kept in sync).
      const view = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-4.6,1]);
      let mvp = mat4Mul(proj, view);

      const floatY = Math.sin(t * 1.1) * 0.05;
      const swayY = Math.sin(t * 0.6) * 0.14;
      const swayX = Math.cos(t * 0.43) * 0.05;
      const model = rotationXY(pitch + swayX, yaw + swayY);
      model[13] = floatY;
      mvp = mat4Mul(mvp, model);

      gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniformMatrix4fv(uModel, false, model);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }
    raf = requestAnimationFrame(frame);

    canvas.__phone3d = {
      getYaw: () => yaw, getYawVel: () => yawVel, getPitch: () => pitch,
    };

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); cancelAnimationFrame(raf);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      lastT = 0; raf = requestAnimationFrame(frame);
    });

    console.info("[phone-3d] floating iPhone v2 running (WebGL2, extruded mesh)");
    return true;
  }

  function boot() {
    const bind = () => {
      let n = 0;
      document.querySelectorAll("[data-phone-3d]:not([data-phone3d-bound])").forEach((host) => {
        host.dataset.phone3dBound = "1";
        host.style.position = host.style.position || "relative";
        // The React wrapper around the host is capped at 360px in the bundle;
        // widen it so the bigger canvas is not squeezed back down.
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
