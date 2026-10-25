import { createHash } from 'node:crypto';
import { existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('product: nonfinite number');
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error('product: non-JSON value');
  return result;
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error('product: ' + message); };
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' must be an object'); }
function keys(value, allowed, label) { object(value, label); for (const k of Object.keys(value)) if (!allowed.includes(k)) fail(label + ': unknown field ' + k); }
function text(value, label, max = 200) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) fail(label + ' invalid'); }
function number(value, label, min, max) { if (!Number.isFinite(value) || value < min || value > max) fail(label + ' out of range'); }
export function productPath(root, name, { checkFiles = true, directory = false } = {}) {
  text(name, 'path', 400);
  if (isAbsolute(name) || !/^[a-zA-Z0-9_./-]+$/.test(name) || name.split('/').some(s => !s || s === '.' || s === '..')) fail('unsafe path ' + name);
  const full = resolve(root, name);
  if (checkFiles) {
    if (!existsSync(full)) fail('missing path ' + name);
    let part = resolve(root);
    for (const segment of name.split('/')) {
      part = resolve(part, segment);
      if (lstatSync(part).isSymbolicLink()) fail('symlink path forbidden ' + name);
    }
    const rel = relative(realpathSync(root), realpathSync(full));
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) fail('path escapes root ' + name);
    if (directory ? !statSync(full).isDirectory() : !statSync(full).isFile()) fail('wrong path kind ' + name);
  }
  return full;
}
function https(value, label) {
  text(value, label, 1000); let u;
  try { u = new URL(value); } catch { fail(label + ' invalid URL'); }
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) fail(label + ' requires public HTTPS URL');
}

/** Closed, secret-free declaration. Store metadata is optional for local builds, required by release gate. */
export function validateProductConfig(raw, root, { checkFiles = true } = {}) {
  keys(raw, ['schemaVersion', 'id', 'title', 'version', 'buildNumber', 'source', 'viewport', 'ios', 'resources', 'runtime', 'icon', 'store'], 'config');
  if (raw.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (typeof raw.id !== 'string' || !/^[a-z][a-z0-9-]{1,62}$/.test(raw.id)) fail('id invalid');
  text(raw.title, 'title', 80);
  if (typeof raw.version !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(raw.version)) fail('version requires x.y.z');
  if (!Number.isSafeInteger(raw.buildNumber) || raw.buildNumber < 1) fail('buildNumber invalid');
  keys(raw.source, ['kind', 'entry', 'path'], 'source');
  if (raw.source.kind === 'module') {
    if (raw.source.path !== undefined || typeof raw.source.entry !== 'string' || !/^games\/.+\.(ts|tsx)$/.test(raw.source.entry)) fail('module requires games/... entry');
    productPath(root, raw.source.entry, { checkFiles });
  } else if (raw.source.kind === 'manifest') {
    if (raw.source.entry !== undefined || typeof raw.source.path !== 'string' || !raw.source.path.endsWith('.json')) fail('manifest requires JSON path');
    productPath(root, raw.source.path, { checkFiles });
  } else fail('source.kind must be module or manifest');
  keys(raw.viewport, ['width', 'height', 'orientation'], 'viewport');
  number(raw.viewport.width, 'viewport.width', 160, 4096); number(raw.viewport.height, 'viewport.height', 160, 4096);
  if (!['portrait', 'landscape', 'all'].includes(raw.viewport.orientation)) fail('orientation invalid');
  keys(raw.ios, ['bundleIdentifier', 'minimumOS'], 'ios');
  if (typeof raw.ios.bundleIdentifier !== 'string' || !/^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*){2,}$/.test(raw.ios.bundleIdentifier)) fail('bundleIdentifier invalid');
  if (typeof raw.ios.minimumOS !== 'string' || !/^\d{2}\.\d{1,2}$/.test(raw.ios.minimumOS) || Number(raw.ios.minimumOS) < 15) fail('minimumOS must be >=15.0');
  if (raw.resources !== undefined) {
    if (!Array.isArray(raw.resources) || raw.resources.length > 100) fail('resources must be an array');
    if (new Set(raw.resources).size !== raw.resources.length) fail('resources duplicated');
    for (const item of raw.resources) {
      productPath(root, 'public/' + item, { checkFiles: false });
      if (checkFiles) {
        if (!existsSync(resolve(root, 'public', item))) fail('missing public resource ' + item);
        const full = productPath(root, 'public/' + item, { checkFiles, directory: statSync(resolve(root, 'public', item)).isDirectory() });
        if (!existsSync(full)) fail('missing public resource ' + item);
      }
      if (/^(assets|index\.html|product\.json)(\/|$)/.test(item)) fail('resource collides with generated bundle ' + item);
    }
  }
  if (raw.runtime !== undefined) {
    keys(raw.runtime, ['touch', 'save', 'audio'], 'runtime');
    if (raw.runtime.touch !== undefined) {
      const t = raw.runtime.touch; keys(t, ['mode', 'deadZone', 'range', 'tapAction'], 'touch');
      if (t.mode !== 'drag') fail('touch.mode must be drag');
      number(t.range ?? 64, 'touch.range', 8, 400); number(t.deadZone ?? 8, 'touch.deadZone', 0, (t.range ?? 64) - .01);
      if (t.tapAction !== undefined) text(t.tapAction, 'tapAction', 100);
    }
    if (raw.runtime.save !== undefined) {
      const s = raw.runtime.save; keys(s, ['slot', 'intervalMs'], 'save'); text(s.slot, 'save.slot', 120);
      if (!/^[a-zA-Z0-9_.:-]+-v\d+$/.test(s.slot)) fail('save.slot must be namespaced and versioned (...-v1)');
      if (s.intervalMs !== undefined) number(s.intervalMs, 'save.intervalMs', 1000, 600000);
    }
    if (raw.runtime.audio !== undefined) {
      keys(raw.runtime.audio, ['specs'], 'audio'); object(raw.runtime.audio.specs, 'audio.specs');
      for (const [id, spec] of Object.entries(raw.runtime.audio.specs)) {
        text(id, 'clipId', 100); keys(spec, ['partials', 'gain'], 'audio spec');
        if (!Array.isArray(spec.partials) || !spec.partials.length || spec.partials.length > 32) fail('audio partials invalid');
        if (spec.gain !== undefined) number(spec.gain, 'audio gain', 0, 4);
        for (const p of spec.partials) {
          keys(p, ['wave', 'freq', 'freqTo', 'dur', 'gain', 'at', 'attack', 'noise'], 'audio partial');
          if (p.wave !== undefined && !['sine', 'square', 'sawtooth', 'triangle'].includes(p.wave)) fail('audio wave invalid');
          for (const k of ['freq', 'freqTo']) if (p[k] !== undefined) number(p[k], k, 1, 24000);
          if (p.dur !== undefined) number(p.dur, 'audio duration', .001, 30);
          for (const k of ['gain', 'at', 'attack']) if (p[k] !== undefined) number(p[k], k, 0, 30);
          if (p.noise !== undefined && typeof p.noise !== 'boolean') fail('noise must be boolean');
        }
      }
    }
  }
  if (raw.icon !== undefined) {
    if (typeof raw.icon !== 'string' || !raw.icon.endsWith('.png')) fail('icon requires PNG');
    productPath(root, raw.icon, { checkFiles });
  }
  if (raw.store !== undefined) {
    keys(raw.store, ['privacyPolicyURL', 'supportURL', 'ageRating', 'exportCompliance'], 'store');
    if (raw.store.privacyPolicyURL !== undefined) https(raw.store.privacyPolicyURL, 'privacyPolicyURL');
    if (raw.store.supportURL !== undefined) https(raw.store.supportURL, 'supportURL');
    if (raw.store.ageRating !== undefined && !['4+', '9+', '13+', '16+', '18+'].includes(raw.store.ageRating)) fail('ageRating invalid');
    if (raw.store.exportCompliance !== undefined) {
      keys(raw.store.exportCompliance, ['usesNonExemptEncryption'], 'exportCompliance');
      if (typeof raw.store.exportCompliance.usesNonExemptEncryption !== 'boolean') fail('exportCompliance requires explicit boolean');
    }
  }
  canonicalJson(raw); // rejects non-JSON values even in nested sound data
  return JSON.parse(canonicalJson(raw));
}
