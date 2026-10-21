// Player-only presentation fix: retain CSS/world coordinates while rasterizing
// at the screen density. Cap at 2x (4x pixels) to bound per-character GPU cost.
export function nativeRasterMetrics(width, height, density, enabled) {
  const scale = enabled && Number.isFinite(density) ? Math.min(2, Math.max(1, density)) : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function replaceOnce(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw new Error('Native raster adapter anchor must match exactly once.');
  return source.replace(anchor, replacement);
}

// Build adapter, not an edit to pinned third-party source. Export/capture sizing
// stays upstream when skipResize is true; non-player viewport stays upstream.
export function adaptNativeRaster(source) {
  const resize = `    if (!skipResize) {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width  = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
    }`;
  source = replaceOnce(source, resize, `    const nativeHiDpi = exportMode && !skipResize;
    if (!skipResize) {
      const raster = nativeRasterMetrics(canvas.clientWidth, canvas.clientHeight, globalThis.devicePixelRatio, nativeHiDpi);
      if (canvas.width !== raster.width || canvas.height !== raster.height) {
        canvas.width = raster.width;
        canvas.height = raster.height;
      }
    }`);
  source = replaceOnce(source,
    'const camera = buildCameraMatrix(canvas.width, canvas.height, zoom, panX, panY);',
    'const camera = buildCameraMatrix(nativeHiDpi ? Math.max(1, canvas.clientWidth) : canvas.width, nativeHiDpi ? Math.max(1, canvas.clientHeight) : canvas.height, zoom, panX, panY);');
  return `${nativeRasterMetrics.toString()}\n${source}`;
}

// Upstream already generates the mip chain but samples only the full-size
// level. Trilinear minification uses that chain to calm fine-fur aliasing at
// room scale; magnification and the source alpha/PNG remain unchanged.
export function adaptNativeTexture(source) {
  return replaceOnce(source,
    'gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);',
    'gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);');
}
