import type { ImageMeshMotion } from './types.js';

type Region = ImageMeshMotion['regions'][number];
const GRID = 36;
const TAU = Math.PI * 2;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const inRange = (n: unknown, lo: number, hi: number): n is number => finite(n) && n >= lo && n <= hi;
const pair = (v: unknown, lo: number, hi: number): v is readonly [number, number] =>
  Array.isArray(v) && v.length === 2 && inRange(v[0], lo, hi) && inRange(v[1], lo, hi);

/** 数据边界：拒绝无穷值、过大变形和任意脚本；无效配置只显示原图。 */
export function parseImageMeshMotion(raw: string): ImageMeshMotion | undefined {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return undefined; }
  if (!value || typeof value !== 'object') return undefined;
  const rig = value as Partial<ImageMeshMotion>;
  if (!inRange(rig.cycleMs, 1200, 30000) || !Array.isArray(rig.regions) || rig.regions.length < 1 || rig.regions.length > 8) return undefined;
  for (const region of rig.regions) {
    if (!region || typeof region !== 'object') return undefined;
    const r = region as Region;
    if (!pair(r.center, 0, 1) || !pair(r.radius, 0.02, 0.8) || !pair(r.move, -0.06, 0.06)) return undefined;
    if (r.scale !== undefined && !pair(r.scale, -0.06, 0.06)) return undefined;
    if (r.harmonic !== undefined && !inRange(r.harmonic, 1, 5)) return undefined;
    if (r.harmonic !== undefined && !Number.isInteger(r.harmonic)) return undefined;
  }
  return rig as ImageMeshMotion;
}

/** 纯函数：网格顶点的局部柔性位移。区域边沿及周期首尾均连续。 */
export function imageMeshPoint(rig: ImageMeshMotion, elapsedMs: number, x: number, y: number): readonly [number, number] {
  let px = x; let py = y;
  for (const r of rig.regions) {
    const nx = (x - r.center[0]) / r.radius[0];
    const ny = (y - r.center[1]) / r.radius[1];
    const d2 = nx * nx + ny * ny;
    if (d2 >= 1) continue;
    const weight = (1 - d2) ** 2;
    const wave = Math.sin(TAU * elapsedMs / rig.cycleMs * (r.harmonic ?? 1));
    px += weight * wave * (r.move[0] + nx * (r.scale?.[0] ?? 0));
    py += weight * wave * (r.move[1] + ny * (r.scale?.[1] ?? 0));
  }
  return [px, py];
}

interface MeshInstance { element: HTMLElement; dispose(): void }

function shader(gl: WebGLRenderingContext, kind: number, source: string): WebGLShader | undefined {
  const out = gl.createShader(kind);
  if (!out) return undefined;
  gl.shaderSource(out, source);
  gl.compileShader(out);
  if (gl.getShaderParameter(out, gl.COMPILE_STATUS)) return out;
  gl.deleteShader(out);
  return undefined;
}

function startMesh(element: HTMLElement, rig: ImageMeshMotion): MeshInstance | undefined {
  const poster = element.querySelector<HTMLImageElement>('[data-mesh-poster]');
  const canvas = element.querySelector<HTMLCanvasElement>('[data-mesh-canvas]');
  if (!poster || !canvas) return undefined;
  let raf = 0;
  let disposed = false;
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let indexBuffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;
  let startedAt = 0;
  let lastFrame = 0;

  const indices = new Uint16Array(GRID * GRID * 6);
  let at = 0;
  for (let row = 0; row < GRID; row++) for (let col = 0; col < GRID; col++) {
    const top = row * (GRID + 1) + col;
    indices.set([top, top + GRID + 1, top + 1, top + 1, top + GRID + 1, top + GRID + 2], at);
    at += 6;
  }
  const vertices = new Float32Array((GRID + 1) ** 2 * 4);

  const draw = (now: number): void => {
    if (disposed || !gl || !program || !buffer || !indexBuffer || !texture) return;
    raf = requestAnimationFrame(draw);
    if (document.hidden || now - lastFrame < 30) return; // 柔性待机约 30fps；后台不空转 GPU
    lastFrame = now;
    if (!startedAt) startedAt = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (width < 2 || height < 2) return;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const scale = Math.min(width / poster.naturalWidth, height / poster.naturalHeight);
    const imageW = poster.naturalWidth * scale;
    const imageH = poster.naturalHeight * scale;
    const left = (width - imageW) / 2;
    const top = (height - imageH) / 2;
    let i = 0;
    for (let row = 0; row <= GRID; row++) for (let col = 0; col <= GRID; col++) {
      const u = col / GRID;
      const v = row / GRID;
      const [x, y] = imageMeshPoint(rig, now - startedAt, u, v);
      vertices[i++] = (left + x * imageW) / width * 2 - 1;
      vertices[i++] = 1 - (top + y * imageH) / height * 2;
      vertices[i++] = u;
      vertices[i++] = v;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    const uv = gl.getAttribLocation(program, 'a_uv');
    if (position < 0 || uv < 0) return;
    gl.enableVertexAttribArray(position);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    canvas.style.opacity = '1';
    poster.style.opacity = '0';
  };

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    if (raf) cancelAnimationFrame(raf);
    canvas.style.opacity = '0';
    poster.style.opacity = '1';
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  const init = (): void => {
    if (disposed || !poster.naturalWidth || !poster.naturalHeight) return;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
      if (!gl) return;
      const vert = shader(gl, gl.VERTEX_SHADER, 'attribute vec2 a_position; attribute vec2 a_uv; varying vec2 v_uv; void main(){v_uv=a_uv;gl_Position=vec4(a_position,0.0,1.0);}');
      const frag = shader(gl, gl.FRAGMENT_SHADER, 'precision mediump float; varying vec2 v_uv; uniform sampler2D u_image; void main(){gl_FragColor=texture2D(u_image,v_uv);}');
      if (!vert || !frag) return;
      program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      buffer = gl.createBuffer();
      indexBuffer = gl.createBuffer();
      texture = gl.createTexture();
      if (!buffer || !indexBuffer || !texture) return;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, poster);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      raf = requestAnimationFrame(draw);
    } catch { /* 图片不可上传纹理或 WebGL 不可用：保留静态海报 */ }
  };
  poster.addEventListener('load', init, { once: true });
  if (poster.complete) init();
  return {
    element,
    dispose: () => {
      disposed = true;
      poster.removeEventListener('load', init);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (raf) cancelAnimationFrame(raf);
      if (gl && !gl.isContextLost()) {
        if (texture) gl.deleteTexture(texture);
        if (buffer) gl.deleteBuffer(buffer);
        if (indexBuffer) gl.deleteBuffer(indexBuffer);
        if (program) gl.deleteProgram(program);
      }
      canvas.style.opacity = '0';
      poster.style.opacity = '1';
    },
  };
}

/** mountUI 的可重入运行时：只接管标记图片；替换子树/卸载时释放 GPU 资源。 */
export function mountImageMeshMotions(host: HTMLElement): { sync(): void; dispose(): void } {
  const instances = new Map<HTMLElement, MeshInstance>();
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return {
    sync: () => {
      for (const [element, instance] of instances) if (!host.contains(element)) { instance.dispose(); instances.delete(element); }
      if (reduced || typeof requestAnimationFrame !== 'function') return;
      host.querySelectorAll<HTMLElement>('[data-image-mesh]').forEach((element) => {
        if (instances.has(element)) return;
        const rig = parseImageMeshMotion(element.dataset['imageMesh'] ?? '');
        if (!rig) return;
        const instance = startMesh(element, rig);
        if (instance) instances.set(element, instance);
      });
    },
    dispose: () => { for (const instance of instances.values()) instance.dispose(); instances.clear(); },
  };
}
