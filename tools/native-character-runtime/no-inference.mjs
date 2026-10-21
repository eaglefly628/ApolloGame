// CanvasViewport imports its upstream authoring wizard. The game cannot open
// it, and deliberately ships no DWPose/ONNX model, WASM or CDN integration.
// Keep vendor files unchanged; fail explicitly if authoring inference is called.
throw new Error('Native player distribution does not include authoring inference');
