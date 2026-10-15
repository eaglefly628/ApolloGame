// Real browser acceptance: native upstream app vs engine embedding, same asset/time.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.NATIVE_CHARACTER_URL ?? 'http://127.0.0.1:5182';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const record = page => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
};
const digest = uri => createHash('sha256').update(Buffer.from(uri.split(',')[1], 'base64')).digest('hex');
try {
  const engine = await browser.newPage({ viewport: { width: 900, height: 900 } }); record(engine);
  await engine.goto(`${base}/engine.html`);
  await engine.waitForFunction(() => !!window.apolloCharacterReady);
  const initial = await engine.evaluate(() => window.apolloCharacterReady);
  assert.equal(initial.playing, true);
  await engine.evaluate(() => window.apolloCharacter.command({ type: 'pause' }));
  const command = value => engine.evaluate(value => window.apolloCharacter.command(value), value);
  const baseline = await browser.newPage({ viewport: { width: 1100, height: 1000 } }); record(baseline);
  await baseline.goto(`${base}/reference.html?mode=player`);
  await baseline.waitForSelector('canvas');
  await baseline.evaluate(async () => {
    const { loadProject } = await import('/vendor/stretchystudio/src/io/projectFile.js');
    const { useProjectStore } = await import('/vendor/stretchystudio/src/store/projectStore.js');
    const { useAnimationStore } = await import('/vendor/stretchystudio/src/store/animationStore.js');
    const { useEditorStore } = await import('/vendor/stretchystudio/src/store/editorStore.js');
    const { useParameterStore } = await import('/vendor/stretchystudio/src/store/parameterStore.js');
    const bytes = await (await fetch('/art/native-character-demo.stretch')).arrayBuffer();
    const { project } = await loadProject(new File([bytes], 'native.stretch'));
    useProjectStore.getState().loadProject(project);
    useParameterStore.getState().resetToDefaults(project.parameters);
    const canvas = document.querySelector('canvas');
    canvas.style.cssText = 'position:fixed;width:600px;height:760px;left:0;top:0';
    useEditorStore.getState().setSelection([]);
    useEditorStore.getState().setShowSkeleton(false);
    useEditorStore.getState().setEditorMode('animation');
    useAnimationStore.getState().setActiveAnimationId('idle');
    useAnimationStore.getState().setFps(30);
    useAnimationStore.getState().setEndFrame(120);
    useAnimationStore.getState().setLoopKeyframes(true);
    window.nativeAudit = { useEditorStore, useAnimationStore, useParameterStore };
  });
  // Wait for the native component's initial centering and image decode to settle.
  await baseline.waitForTimeout(300);
  await baseline.evaluate(() => window.nativeAudit.useEditorStore.getState().setView({ zoom: 0.9, panX: 30, panY: 38 }));
  const comparisons = [];
  for (const timeMs of [0, 1380, 2000]) {
    await command({ type: 'seek', timeMs });
    const actual = await command({ type: 'capture' });
    const expected = await baseline.evaluate(async timeMs => {
      window.nativeAudit.useAnimationStore.getState().seekTime(timeMs);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return document.querySelector('canvas').toDataURL('image/png');
    }, timeMs);
    const match = digest(actual) === digest(expected);
    comparisons.push({ timeMs, nativeSha256: digest(expected), engineSha256: digest(actual), identical: match });
    assert.ok(match, `Native/engine frame differs at ${timeMs}ms`);
  }
  assert.notEqual(comparisons[0].engineSha256, comparisons[1].engineSha256, 'Blink must visibly change the frame');
  assert.notEqual(comparisons[0].engineSha256, comparisons[2].engineSha256, 'Mesh sway/breathing must visibly change the frame');
  await command({ type: 'parameters', values: { 'gaze-x': -1 } });
  const left = await command({ type: 'capture' });
  await command({ type: 'parameters', values: { 'gaze-x': 1 } });
  const right = await command({ type: 'capture' });
  assert.notEqual(digest(left), digest(right), 'Parameter must affect character');
  const switched = await command({ type: 'play', clipId: 'turn', loop: false });
  assert.equal(switched.clipId, 'turn');
  const paused = await command({ type: 'pause' });
  assert.equal(paused.playing, false);
  const stopped = await command({ type: 'status' });
  assert.equal(stopped.timeMs, paused.timeMs);
  const motionChecks = [];
  for (const clipId of ['showcase', 'curious', 'nod', 'shake', 'wink', 'greeting']) {
    await command({ type: 'play', clipId });
    await command({ type: 'pause' });
    await command({ type: 'seek', timeMs: 0 });
    const first = digest(await command({ type: 'capture' }));
    await command({ type: 'seek', timeMs: clipId === 'showcase' ? 5000 : clipId === 'shake' ? 600 : clipId === 'greeting' ? 1800 : 1000 });
    const changed = digest(await command({ type: 'capture' })) !== first;
    assert.ok(changed, `${clipId} must visibly animate`);
    motionChecks.push({ clipId, visiblyChanges: changed });
  }
  const rejected = await engine.evaluate(async () => {
    try { await window.apolloCharacter.command({ type: 'play', clipId: 'missing' }); return false; } catch { return true; }
  });
  assert.ok(rejected, 'Unknown clip must reject');
  const corrupt = await engine.evaluate(async () => {
    try { await window.apolloCharacter.command({ type: 'load', bytes: new ArrayBuffer(4) }); return false; } catch { return true; }
  });
  assert.ok(corrupt, 'Corrupt bundle must reject');
  const original = await readFile(path.join(root, 'public/art/native-character-demo.stretch'));
  const brokenAudio = await JSZip.loadAsync(original);
  const brokenAudioProject = JSON.parse(await brokenAudio.file('project.json').async('string'));
  brokenAudioProject.animations[0].audioTracks = [{ id: 'missing', source: 'audios/missing.wav', mimeType: 'audio/wav' }];
  brokenAudio.file('project.json', JSON.stringify(brokenAudioProject));
  const missingAudio = await engine.evaluate(async bytes => {
    try { await window.apolloCharacter.command({ type: 'load', bytes: new Uint8Array(bytes).buffer }); return false; } catch { return true; }
  }, Array.from(await brokenAudio.generateAsync({ type: 'uint8array' })));
  assert.ok(missingAudio, 'Missing bundled audio must reject');
  const brokenTexture = await JSZip.loadAsync(original);
  brokenTexture.file('textures/part-0.png', 'broken PNG');
  const badTexture = await engine.evaluate(async bytes => {
    try { await window.apolloCharacter.command({ type: 'load', bytes: new Uint8Array(bytes).buffer }); return false; } catch { return true; }
  }, Array.from(await brokenTexture.generateAsync({ type: 'uint8array' })));
  assert.ok(badTexture, 'Broken PNG must reject');
  const preserved = await JSZip.loadAsync(original);
  const nativeProject = JSON.parse(await preserved.file('project.json').async('string'));
  const nativePhysics = [{ id: 'review-preserve-physics', enabled: true, output: { parameterId: 'gaze-x', scale: 0.15 } }];
  nativeProject.physicsRules = nativePhysics;
  preserved.file('project.json', JSON.stringify(nativeProject));
  await engine.evaluate(async bytes => window.apolloCharacter.command({ type: 'load', bytes: new Uint8Array(bytes).buffer }), Array.from(await preserved.generateAsync({ type: 'uint8array' })));
  const playerFrame = engine.frames().find(frame => frame.url().includes('mode=player'));
  const loadedPhysics = await playerFrame.evaluate(async () => (await import('/vendor/stretchystudio/src/store/projectStore.js')).useProjectStore.getState().project.physicsRules);
  assert.deepEqual(loadedPhysics, nativePhysics, 'Original physicsRules must survive native loading');
  await command({ type: 'play', clipId: 'idle' });
  await command({ type: 'pause' });
  await command({ type: 'seek', timeMs: 0 });
  await command({ type: 'parameters', values: { 'gaze-x': 0 } });
  await mkdir(path.join(root, 'evidence'), { recursive: true });
  await writeFile(path.join(root, 'evidence/motion-combinations.json'), JSON.stringify(motionChecks, null, 2) + '\n');
  await engine.screenshot({ path: path.join(root, 'evidence/engine.png') });
  await baseline.screenshot({ path: path.join(root, 'evidence/native-editor.png') });
  await baseline.goto(`${base}/?demo=1`);
  await baseline.getByText('组合展示 · 呼吸 → 观察 → 点头 → 眨眼 → 问候', { exact: true }).last().waitFor();
  await baseline.screenshot({ path: path.join(root, 'evidence/motion-showcase.png') });
  assert.deepEqual(errors, [], 'Browser must have no runtime errors');
  await writeFile(path.join(root, 'evidence/acceptance.json'), JSON.stringify({ checkedAt: new Date().toISOString(), project: 'original vector fixture; not See-through inference', nativeFilesChanged: false, comparisons, checks: ['native pixel equality at 3 times', 'visible blinking', 'visible mesh/breathing changes', 'parameter-driven gaze', 'clip switch', 'pause', 'invalid clip rejection', 'corrupt bundle rejection', 'missing audio rejection', 'broken PNG rejection', 'original physicsRules retained after reload'], browserErrors: errors }, null, 2) + '\n');
  console.log('PASS: native frames match engine frames; playback, parameter and failure handling verified.');
} finally { await browser.close(); }
