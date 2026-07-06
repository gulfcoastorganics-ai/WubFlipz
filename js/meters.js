/* wubflipz — WebGL2 meter renderers
 * Draws spectrum and phase/scope pixels only from analyser frames supplied by ui.js.
 */
(function () {
  "use strict";
  const WF = (window.WF = window.WF || {});

  function shader(gl, type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "program link failed");
    return p;
  }
  function context(canvas) {
    if (!canvas) return null;
    try {
      const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, preserveDrawingBuffer: false });
      if (!gl) return null;
      gl.getExtension("EXT_color_buffer_float");
      return gl;
    } catch (e) {
      return null;
    }
  }
  function size(canvas, gl) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    return { w, h, dpr };
  }

  function createSpectrum(canvas) {
    const gl = context(canvas);
    if (!gl) return null;
    const p = program(gl, `#version 300 es
      precision highp float;
      out vec2 vUv;
      const vec2 pts[6] = vec2[6](
        vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0),
        vec2(-1.0,1.0), vec2(1.0,-1.0), vec2(1.0,1.0)
      );
      void main() {
        vec2 pos = pts[gl_VertexID];
        vUv = pos * 0.5 + 0.5;
        gl_Position = vec4(pos, 0.0, 1.0);
      }`, `#version 300 es
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D uBins;
      uniform float uBinCount;
      uniform float uActive;
      float binLevel(float x) {
        float shaped = pow(clamp(x, 0.0, 1.0), 2.2);
        float idx = floor(shaped * max(1.0, uBinCount - 1.0));
        float db = texelFetch(uBins, ivec2(int(idx), 0), 0).r;
        return clamp((db + 90.0) / 90.0, 0.0, 1.0) * uActive;
      }
      void main() {
        float bars = 48.0;
        float bar = floor(vUv.x * bars);
        float local = fract(vUv.x * bars);
        float gap = step(0.08, local) * step(local, 0.92);
        float level = binLevel((bar + 0.5) / bars);
        float fill = step(vUv.y, max(level * 0.92, 0.0)) * gap;
        vec3 base = vec3(0.02, 0.018, 0.014);
        vec3 lo = vec3(0.12, 0.42, 0.28);
        vec3 hi = vec3(0.96, 0.70, 0.24);
        vec3 col = mix(lo, hi, vUv.y);
        outColor = vec4(mix(base, col, fill), 1.0);
      }`);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const locBins = gl.getUniformLocation(p, "uBins");
    const locCount = gl.getUniformLocation(p, "uBinCount");
    const locActive = gl.getUniformLocation(p, "uActive");
    const silentBin = new Float32Array([ -90 ]);
    let texBins = 0;
    return {
      draw(freq, active) {
        size(canvas, gl);
        const bins = freq && freq.length ? freq.length : 1;
        gl.useProgram(p);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (bins !== texBins) {
          texBins = bins;
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, texBins, 1, 0, gl.RED, gl.FLOAT, freq || silentBin);
        } else if (freq) {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, texBins, 1, gl.RED, gl.FLOAT, freq);
        }
        gl.uniform1i(locBins, 0);
        gl.uniform1f(locCount, texBins);
        gl.uniform1f(locActive, active && freq ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    };
  }

  function createPhase(canvas) {
    const gl = context(canvas);
    if (!gl) return null;
    const p = program(gl, `#version 300 es
      precision highp float;
      in vec2 aPos;
      uniform vec2 uScale;
      uniform float uPointSize;
      void main() {
        gl_Position = vec4(aPos * uScale, 0.0, 1.0);
        gl_PointSize = uPointSize;
      }`, `#version 300 es
      precision highp float;
      out vec4 outColor;
      uniform vec4 uColor;
      void main() { outColor = uColor; }`);
    const pointBuf = gl.createBuffer();
    const gridBuf = gl.createBuffer();
    const maxPoints = 2048;
    const points = new Float32Array(maxPoints * 2);
    const grid = new Float32Array([
      -0.84, 0, 0.84, 0,
      0, -0.84, 0, 0.84,
      -0.84, -0.84, 0.84, 0.84
    ]);
    const locPos = gl.getAttribLocation(p, "aPos");
    const locScale = gl.getUniformLocation(p, "uScale");
    const locColor = gl.getUniformLocation(p, "uColor");
    const locPointSize = gl.getUniformLocation(p, "uPointSize");
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
    gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, points.byteLength, gl.DYNAMIC_DRAW);
    return {
      draw(frame, active) {
        const dims = size(canvas, gl);
        gl.clearColor(0.02, 0.018, 0.014, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(p);
        gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(locScale, 1, 1);
        gl.uniform1f(locPointSize, 1);
        gl.uniform4f(locColor, 0.96, 0.88, 0.75, 0.12);
        gl.drawArrays(gl.LINES, 0, 6);

        const stereo = !!(frame && frame.timeL && frame.timeR && active);
        const mono = !!(frame && frame.time && active);
        const sourceLen = stereo ? Math.min(frame.timeL.length, frame.timeR.length) : mono ? frame.time.length : 0;
        const n = Math.min(maxPoints, sourceLen);
        for (let i = 0; i < n; i++) {
          const si = Math.floor((i / Math.max(1, n)) * sourceLen);
          let x = 0, y = 0;
          if (stereo) {
            const l = frame.timeL[si] || 0;
            const r = frame.timeR[si] || 0;
            x = (r - l) * 0.594;
            y = (l + r) * 0.594;
          } else if (mono) {
            const v = frame.time[si] || 0;
            x = v * 0.84;
            y = v * 0.84;
          }
          points[i * 2] = Math.max(-0.95, Math.min(0.95, x));
          points[i * 2 + 1] = Math.max(-0.95, Math.min(0.95, y));
        }
        if (n > 0) {
          gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
          gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
          gl.uniform1f(locPointSize, Math.max(1.25, 1.6 * dims.dpr));
          gl.uniform4f(locColor, 0.44, 0.89, 0.65, active ? 0.78 : 0.20);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, points, 0, n * 2);
          gl.drawArrays(gl.POINTS, 0, n);
        }
      }
    };
  }

  function createScalar(canvas, options) {
    const gl = context(canvas);
    if (!gl) return null;
    const centered = !!(options && options.centered);
    const p = program(gl, `#version 300 es
      precision highp float;
      out vec2 vUv;
      const vec2 pts[6] = vec2[6](
        vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0),
        vec2(-1.0,1.0), vec2(1.0,-1.0), vec2(1.0,1.0)
      );
      void main() {
        vec2 pos = pts[gl_VertexID];
        vUv = pos * 0.5 + 0.5;
        gl_Position = vec4(pos, 0.0, 1.0);
      }`, `#version 300 es
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform float uAmount;
      uniform float uCentered;
      void main() {
        float a = clamp(uAmount, 0.0, 1.0);
        float fill = step(vUv.x, a);
        if (uCentered > 0.5) {
          float lo = min(0.5, a);
          float hi = max(0.5, a);
          fill = step(lo, vUv.x) * step(vUv.x, hi);
        }
        if (fill < 0.5) discard;
        vec3 loCol = uCentered > 0.5 && a < 0.5 ? vec3(0.96, 0.70, 0.24) : vec3(0.44, 0.89, 0.65);
        vec3 hiCol = vec3(0.96, 0.70, 0.24);
        outColor = vec4(mix(loCol, hiCol, vUv.x), 0.94);
      }`);
    const locAmount = gl.getUniformLocation(p, "uAmount");
    const locCentered = gl.getUniformLocation(p, "uCentered");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return {
      draw(amount) {
        size(canvas, gl);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(p);
        gl.uniform1f(locAmount, Math.max(0, Math.min(1, amount || 0)));
        gl.uniform1f(locCentered, centered ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    };
  }

  WF.Meters = { createSpectrum, createPhase, createScalar };
})();
