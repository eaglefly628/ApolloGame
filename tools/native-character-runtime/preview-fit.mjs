// One projection for the native asset viewport and its authoring scale anchor.
export function previewFit(width, height, canvas) {
  // Production contain matches the poster, not the workbench's 10% safe border.
  const zoom = Math.min(width / canvas.width, height / canvas.height);
  return { zoom, panX: (width - canvas.width * zoom) / 2, panY: (height - canvas.height * zoom) / 2 };
}

export function previewGroundOrigin(width, height, canvas, point) {
  const { zoom, panX, panY } = previewFit(width, height, canvas);
  return [panX + point[0] * zoom, panY + point[1] * zoom];
}

// LayoutNode Image rectangle reproducing the native canvas fit and paw-pivot
// scale, without relying on a square contain box's empty bottom margin.
export function previewPosterRect(width, height, canvas, point, scale) {
  const fit = previewFit(width, height, canvas);
  const origin = previewGroundOrigin(width, height, canvas, point);
  return {
    x: origin[0] + scale * (fit.panX - origin[0]),
    y: origin[1] + scale * (fit.panY - origin[1]),
    width: canvas.width * fit.zoom * scale,
    height: canvas.height * fit.zoom * scale,
  };
}
