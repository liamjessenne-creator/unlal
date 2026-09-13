// UNAL Market — floating 3D iPhone (vanilla WebGL2, zero dependencies).
// A textured phone model (canvas-drawn frame + the existing map photo on its
// screen) that floats idle and can be spun fluidly with drag + inertia.
(() => {
  "use strict";

  // Same photo the old widget used (map preview around UNAL MARKET).
  const IMG_SRC = "/assets/unal-map-preview-dLrHbm-N.svg";

  const PW = 516, PH = 1032;       // phone texture resolution (2x)
  const BODY_R = 74, SCREEN_R = 48;

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function buildPhoneTexture(img) {
    const c = document.createElement("canvas");
    c.width = PW; c.height = PH;
    const g = c.getContext("2d");

    // Titanium frame
    const frame = g.createLinearGradient(0, 0, PW, PH);
    frame.addColorStop(0, "#e6ecf5");
    frame.addColorStop(0.18, "#9aa7b8");
    frame.addColorStop(0.38, "#f2f6fb");
    frame.addColorStop(0.62, "#7f8ca0");
    frame.addColorStop(0.85, "#dbe4ef");
    frame.addColorStop(1, "#8d99ab");
    rr(g, 6, 6, PW - 12, PH - 12, BODY_R);
    g.fillStyle = frame; g.fill();

    // Side buttons
    g.fillStyle = "#b9c3d2";
    rr(g, PW - 8, 240, 8, 120, 4); g.fill();   // power
    rr(g, -2, 180, 8, 64, 4); g.fill();        // vol+
    rr(g, -2, 260, 8, 64, 4); g.fill();        // vol-

    // Black bezel
    rr(g, 20, 20, PW - 40, PH - 40, SCREEN_R + 12);
    g.fillStyle = "#05070d"; g.fill();

    // Screen: the same photo as the old widget
    g.save();
    rr(g, 34, 34, PW - 68, PH - 68, SCREEN_R);
    g.clip();
    g.fillStyle = "#0b1626"; g.fillRect(34, 34, PW - 68, PH - 68);
    // cover-fit the photo
    const iw = img.width || 1024, ih = img.height || 1024;
    const sc = Math.max((PW - 68) / iw, (PH - 68) / ih);
    const dw = iw * sc, dh = ih * sc;
    g.drawImage(img, 34 + (PW - 68 - dw) / 2, 34 + (PH - 68 - dh) / 2, dw, dh);

    // status bar + Dynamic Island (drawn over the photo)
    g.fillStyle = "rgba(3,8,18,0.75)";
    g.fillRect(34, 34, PW - 68, 64);
    rr(g, PW / 2 - 80, 52, 160, 34, 17);
    g.fillStyle = "#000"; g.fill();
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.font = "600 22px system-ui, sans-serif";
    g.textBaseline = "middle";
    g.fillText("9:41", 62, 66);
    g.fillText("100%", PW - 118, 66);
    g.restore();

    return c;
  }

  const VERT = `#version 300 es
in vec2 aPos;
uniform mat4 uMVP;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = uMVP * vec4(aPos, 0.0, 1.0);
}`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSam;
void main() {
  // rounded-corner mask in NDC space
  vec2 ndc = vUv * 2.0 - 1.0;
  float r = 0.155;
  vec2 q = max(abs(ndc) - vec2(1.0 - r), 0.0);
  if (length(q) > r) discard;
  vec4 tex = texture(uSam, vUv);
  // subtle glass glare so the screen reads as glass, photo unchanged
  float glare = smoothstep(0.85, 0.15, distance(vUv, vec2(0.22, 0.72)));
  tex.rgb += vec3(0.05) * glare;
  outColor = vec4(tex.rgb, tex.a);
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
    // R = Rx * Ry (row-major math done column-major below)
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
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("phone-3d link:", gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const uMVP = gl.getUniformLocation(prog, "uMVP");
    gl.uniform1i(gl.getUniformLocation(prog, "uSam"), 0);

    // texture (built when the image is ready)
    let texReady = false;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([10, 20, 40, 255]));
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
        buildPhoneTexture(img));
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      texReady = true;
    };
    img.src = IMG_SRC;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    // ---- float + drag physics -------------------------------------------------
    let yaw = -0.32, pitch = 0.1;          // start pose: slight 3/4 view
    let yawVel = 0, pitchVel = 0;
    let dragging = false, lastX = 0, lastY = 0, lastMoveT = 0;
    let raf = 0, lastT = 0;

    const onDown = (e) => {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY; lastMoveT = performance.now();
      yawVel = 0; pitchVel = 0;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(8, now - lastMoveT) / 1000;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; lastMoveT = now;
      yaw += dx * 0.0062;
      pitch = Math.max(-0.9, Math.min(0.9, pitch + dy * 0.0052));
      yawVel = 0.65 * yawVel + 0.35 * (dx * 0.0062 / dt);
      pitchVel = 0.65 * pitchVel + 0.35 * (dy * 0.0052 / dt);
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
        // inertia decay
        yaw += yawVel * dt;
        pitch += pitchVel * dt;
        yawVel *= Math.exp(-dt * 2.0);
        pitchVel *= Math.exp(-dt * 2.0);
        // spring the pitch gently back upright
        pitchVel += (-pitch * 6.0 - pitchVel * 4.0) * dt;
        pitch = Math.max(-0.9, Math.min(0.9, pitch));
      }

      resize();
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!texReady) return;

      const aspect = canvas.width / Math.max(1, canvas.height);
      const proj = perspective(0.62, aspect, 0.1, 40);
      const view = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-3.4,1]);
      let mvp = mat4Mul(proj, view);

      // floating: gentle bob + idle sway, on top of the user's rotation
      const floatY = Math.sin(t * 1.1) * 0.05;
      const swayY = Math.sin(t * 0.6) * 0.16;
      const swayX = Math.cos(t * 0.43) * 0.05;
      const model = rotationXY(pitch + swayX, yaw + swayY);
      model[13] = floatY;
      mvp = mat4Mul(mvp, model);

      gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    raf = requestAnimationFrame(frame);

    canvas.__phone3d = {
      getYaw: () => yaw,
      getYawVel: () => yawVel,
      getPitch: () => pitch,
    };

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); cancelAnimationFrame(raf);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      lastT = 0; raf = requestAnimationFrame(frame);
    });

    console.info("[phone-3d] floating iPhone running (WebGL2)");
    return true;
  }

  // The host is created by React after boot — keep a cheap re-bind loop so the
  // phone also comes back after SPA route changes.
  function boot() {
    const bind = () => {
      let n = 0;
      document.querySelectorAll("[data-phone-3d]:not([data-phone3d-bound])").forEach((host) => {
        host.dataset.phone3dBound = "1";
        host.style.position = host.style.position || "relative";
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
