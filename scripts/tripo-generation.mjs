import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareTripoInputs, tripoReferences, TRIPO_VIEWS } from './tripo-inputs.mjs';
export { prepareTripoInputs, tripoReferences, TRIPO_VIEWS, parseTripoGenerationArgs } from './tripo-inputs.mjs';

export const TRIPO_IMAGE_MODEL = 'v3.1-20260211';
const BASE = 'https://openapi.tripo3d.ai/v3';

// A complete, deterministic triangle GLB. Its embedded input digest makes mock
// outputs traceable while keeping image bytes and provider credentials private.
function mockGlb(inputs) {
  const references = tripoReferences(inputs);
  const digest = createHash('sha256').update(JSON.stringify(references)).digest('hex');
  const binary = Buffer.alloc(44);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, i) => binary.writeFloatLE(value, i * 4));
  [0, 1, 2].forEach((value, i) => binary.writeUInt16LE(value, 36 + i * 2));
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0', generator: 'Apollo Tripo offline adapter', extras: { inputHash: digest, references } },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 }, { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }],
  }));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + padded.length + 8 + binary.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, padded, binHeader, binary]);
}

function validateGlb(buffer) {
  const invalid = detail => { throw new Error(`Tripo GLB ${detail}`); };
  if (buffer.length < 20 || buffer.length % 4 || buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) {
    invalid('header is invalid (expected a complete GLB 2 file)');
  }
  let offset = 12, chunks = 0, document, binLength;
  while (offset < buffer.length) {
    if (buffer.length - offset < 8) invalid('chunk header is truncated');
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (length % 4 || length > buffer.length - offset) invalid('chunk boundary or alignment is invalid');
    if (chunks === 0 && type !== 0x4e4f534a) invalid('first chunk must be JSON');
    if (type === 0x4e4f534a) {
      if (chunks !== 0) invalid('must contain exactly one first JSON chunk');
      try { document = JSON.parse(buffer.toString('utf8', offset, offset + length)); }
      catch { invalid('JSON chunk is invalid'); }
    } else if (type === 0x004e4942) {
      if (binLength !== undefined || chunks !== 1) invalid('BIN chunk must be unique and follow JSON');
      binLength = length;
    }
    offset += length;
    chunks++;
  }
  if (document?.asset?.version !== '2.0') invalid('asset version must be 2.0');
  const buffers = document.buffers ?? [], views = document.bufferViews ?? [], images = document.images ?? [];
  if (![buffers, views, images].every(Array.isArray)) invalid('buffers, bufferViews and images must be arrays');
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const embeddedUri = uri => typeof uri === 'string' && /^data:/i.test(uri);
  let internal = false;
  for (const [index, entry] of buffers.entries()) {
    if (!entry || !integer(entry.byteLength)) invalid('buffer byteLength is invalid');
    if (entry.uri === undefined) {
      if (index !== 0 || internal || binLength === undefined) invalid('internal buffer requires the first buffer and a BIN chunk');
      if (entry.byteLength > binLength || binLength - entry.byteLength > 3) invalid('BIN length does not match its internal buffer');
      internal = true;
    } else if (!embeddedUri(entry.uri)) invalid('external buffer URI is forbidden');
  }
  if (binLength !== undefined && !internal) invalid('BIN chunk requires an internal buffer');
  for (const view of views) {
    if (!view || !integer(view.buffer) || view.buffer >= buffers.length || !integer(view.byteLength) || !integer(view.byteOffset ?? 0)) invalid('bufferView range is invalid');
    const start = view.byteOffset ?? 0;
    if (start > buffers[view.buffer].byteLength || view.byteLength > buffers[view.buffer].byteLength - start) invalid('bufferView exceeds its buffer');
  }
  for (const image of images) {
    if (!image || typeof image !== 'object') invalid('image entry is invalid');
    if (image.uri !== undefined && !embeddedUri(image.uri)) invalid('external image URI is forbidden');
    if (image.bufferView !== undefined && (!integer(image.bufferView) || image.bufferView >= views.length)) invalid('image bufferView is invalid');
  }
}

/** Image prompts are local provenance only; provider generation consumes snapshots. */
export async function generateTripoImage(prompt, opts = {}) {
  const apiKey = opts.apiKey ?? process.env.TRIPO_API_KEY;
  const scrub = message => apiKey ? String(message).split(apiKey).join('[redacted]') : String(message);
  try {
    const prepared = await prepareTripoInputs({ mode: opts.mode, inputs: opts.inputs });
    const { mode, inputs } = prepared;
    if (!['image_to_model', 'multiview_to_model'].includes(mode)) throw new Error('Tripo image adapter requires image_to_model or multiview_to_model');
    const editFallback = Boolean(opts.editFallback || prepared.editFallback || inputs.some(input => input.role === 'edit'));
    if (prompt) console.info('[tripo:skip] Image prompt retained locally; provider consumes image inputs only');
    if (editFallback) console.warn('[tripo:downgrade] Local editing unavailable; regenerating the whole model for human selection');
    const mock = Boolean(opts.mock || !apiKey);
    const parameters = { model: TRIPO_IMAGE_MODEL, texture: true, pbr: true };
    const generation = { operation: mode, apiVersion: 'v3', modelVersion: TRIPO_IMAGE_MODEL, parameters, ...(editFallback ? { fallback: 'whole_model_regeneration' } : {}) };
    let buffer;
    if (mock) {
      console.info('[tripo:skip] Offline mock selected; no provider requests');
      buffer = mockGlb(inputs);
    } else {
      const { pollIntervalMs = 3000, maxPolls = 120, requestTimeoutMs = 30000, fetchImpl = globalThis.fetch } = opts;
      if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0 || !Number.isSafeInteger(maxPolls) || maxPolls < 1 || !Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1) throw new Error('Tripo polling and timeout options are invalid');
      if (typeof fetchImpl !== 'function') throw new Error('Tripo fetch implementation is unavailable');
      async function request(url, init, label, json = true) {
        let response;
        try { response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) }); }
        catch { throw new Error(`Tripo ${label} request failed or timed out`); }
        if (!response.ok) throw new Error(`Tripo ${label} HTTP request failed${Number.isSafeInteger(response.status) ? ` (status ${response.status})` : ''}`);
        if (!json) {
          try { return Buffer.from(await response.arrayBuffer()); } catch { throw new Error('Tripo download could not be read'); }
        }
        let body;
        try { body = await response.json(); } catch { throw new Error(`Tripo ${label} returned invalid JSON`); }
        if (body?.code !== 0) throw new Error(`Tripo ${label} business request failed${Number.isSafeInteger(body?.code) ? ` (code ${body.code})` : ''}`);
        return body.data;
      }
      const authorization = { Authorization: `Bearer ${apiKey}` };
      const tokens = [];
      for (const input of inputs) {
        const form = new FormData();
        form.append('file', new Blob([input.buffer], { type: 'image/png' }), basename(input.path));
        const upload = await request(`${BASE}/files`, { method: 'POST', headers: authorization, body: form }, 'upload');
        if (typeof upload?.file_token !== 'string' || !upload.file_token.trim()) throw new Error('Tripo upload is missing file_token');
        tokens.push(upload.file_token);
      }
      const payload = mode === 'image_to_model'
        ? { input: tokens[0], ...parameters }
        : { inputs: TRIPO_VIEWS.map((view, i) => ({ [view]: tokens[i] })), ...parameters };
      const endpoint = mode === 'image_to_model' ? 'image-to-model' : 'multiview-to-model';
      const submitted = await request(`${BASE}/generation/${endpoint}`, { method: 'POST', headers: { ...authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 'submission');
      if (typeof submitted?.task_id !== 'string' || !submitted.task_id.trim()) throw new Error('Tripo submission is missing task_id');
      generation.taskId = submitted.task_id;
      let downloadUrl;
      for (let poll = 0; poll < maxPolls; poll++) {
        const task = await request(`${BASE}/tasks/${encodeURIComponent(submitted.task_id)}`, { method: 'GET', headers: authorization }, 'task query');
        if (task?.status === 'success') {
          if (typeof task.output?.model_url !== 'string') throw new Error('Tripo successful task is missing model_url');
          try { downloadUrl = new URL(task.output.model_url); } catch { throw new Error('Tripo download URL is invalid'); }
          if (downloadUrl.protocol !== 'https:' || downloadUrl.username || downloadUrl.password) throw new Error('Tripo download URL must use HTTPS without credentials');
          break;
        }
        if (!['queued', 'running'].includes(task?.status)) throw new Error('Tripo task failed or returned an invalid terminal state');
        if (poll + 1 < maxPolls && pollIntervalMs) await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
      if (!downloadUrl) throw new Error('Tripo task polling timed out');
      buffer = await request(downloadUrl.href, { method: 'GET' }, 'download', false);
    }
    validateGlb(buffer);
    console.info(`[tripo:commit] ${mock ? 'Mock' : 'Provider'} GLB validated (${inputs.length} image inputs)`);
    return { buffer, model: mock ? 'tripo-mock' : TRIPO_IMAGE_MODEL, mock, spec: { scale: 1, genCollision: 'hull' }, generation };
  } catch (error) {
    const safe = scrub(error instanceof Error ? error.message : 'Tripo generation failed');
    console.error(`[tripo:reject] ${safe}`);
    throw new Error(safe);
  }
}
