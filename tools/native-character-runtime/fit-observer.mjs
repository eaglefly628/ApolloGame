import { previewFit } from './preview-fit.mjs';

// Size changes are host presentation state, not playback state: recompute only
// the native camera view, never reload textures or restart the animation.
export function observeNativeFit(canvas, getDimensions, setView, Observer = globalThis.ResizeObserver) {
  const fit = () => {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (width > 0 && height > 0) setView(previewFit(width, height, getDimensions()));
  };
  fit();
  const observer = new Observer(fit);
  observer.observe(canvas);
  return () => observer.disconnect();
}
