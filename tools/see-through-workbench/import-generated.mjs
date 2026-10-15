// Drive the unchanged native PSD wizard, curate project data, export .stretch.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { validateNativeProject } from './project-validation.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const input = path.resolve(process.argv[2]);
const name = process.argv[3] ?? 'generated-character';
if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Use a local asset name containing lowercase letters, digits and hyphens.');
const base = process.env.NATIVE_CHARACTER_URL ?? 'http://127.0.0.1:5182';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/`);
  console.log('Native editor loaded.');
  await page.locator('input[type=file][accept=".stretch,.psd,image/*"]').setInputFiles(input);
  await page.getByRole('button', { name: 'Continue →', exact: true }).click();
  console.log('PSD mapping reviewed; native reorder stage entered.');
  // Native PSD depth sorting can place whites over irises. Curate draw order
  // as editable project data in the wizard's existing reorder stage.
  await page.evaluate(async () => {
    const { useProjectStore } = await import('/vendor/stretchystudio/src/store/projectStore.js');
    const order = ['back hair','wings','tail','footwear','legwear','bottomwear','topwear','neck','neckwear','handwear','objects','ears','earwear','face','nose','eyewhite','irides','eyelash','eyebrow','mouth','front hair','eyewear','headwear'];
    useProjectStore.getState().updateProject(project => {
      const parts = project.nodes.filter(n => n.type === 'part').sort((a,b) => {
        const rank = n => { const i = order.findIndex(tag => n.name.toLowerCase().startsWith(tag)); return i < 0 ? 10 : i; };
        return rank(a) - rank(b);
      });
      parts.forEach((node,i) => { node.draw_order = i; });
    });
  });
  await page.getByRole('button', { name: 'Next: Adjust Joints →', exact: true }).click();
  await page.getByRole('button', { name: 'Next: Setup Parameters →', exact: true }).click();
  await page.getByRole('button', { name: 'Done →', exact: true }).click();
  await page.waitForFunction(async () => {
    const { useProjectStore } = await import('/vendor/stretchystudio/src/store/projectStore.js');
    const textures = useProjectStore.getState().project.textures;
    return textures.length > 0 && textures.every(t => t.source?.startsWith('blob:'));
  });
  console.log('Native binding completed; all generated textures are ready.');
  const exported = await page.evaluate(async () => {
    const { useProjectStore } = await import('/vendor/stretchystudio/src/store/projectStore.js');
    const { useAnimationStore } = await import('/vendor/stretchystudio/src/store/animationStore.js');
    const { useEditorStore } = await import('/vendor/stretchystudio/src/store/editorStore.js');
    const { saveProject } = await import('/vendor/stretchystudio/src/io/projectFile.js');
    const k = pairs => pairs.map(([time,value]) => ({time,value,easing:'ease-both'}));
    const track = (nodeId,property,pairs) => ({nodeId,property,keyframes:k(pairs)});
    useProjectStore.getState().updateProject(project => {
      const head = project.nodes.find(n => n.boneRole === 'head');
      const torso = project.nodes.find(n => n.boneRole === 'torso');
      const params = project.animations.find(a => a.name === 'Parameters');
      const idle = project.animations.find(a => a.name === 'Idle');
      if (!head || !torso || !params || !idle) throw new Error('Native character rig incomplete.');
      const base = [];
      base.push(track(torso.id,'scaleY',[[0,1],[2000,1.008],[4000,1]]));
      base.push(track(head.id,'rotation',[[0,0],[1000,.7],[3000,-.7],[4000,0]]));
      for (const node of project.nodes.filter(n => n.type === 'warpDeformer')) {
        const source = params.tracks.find(t => t.nodeId === node.id && t.property === 'mesh_verts');
        if (!source?.keyframes.length) continue;
        const first = source.keyframes[0].value, last = source.keyframes.at(-1).value;
        if (/Eye[LR]Open/.test(node.parameterId ?? '')) {
          base.push(track(node.id,'mesh_verts',[[0,last],[1400,last],[1510,first],[1660,last],[4000,last]]));
        } else if (/Hair/.test(node.parameterId ?? '')) {
          const mix = factor => first.map((p,i) => ({x:p.x+(last[i].x-p.x)*factor,y:p.y+(last[i].y-p.y)*factor}));
          base.push(track(node.id,'mesh_verts',[[0,mix(.35)],[2000,mix(.65)],[4000,mix(.35)]]));
        }
      }
      idle.id = 'idle'; idle.name = '自然待机 · 呼吸 · 眨眼 · 发丝'; idle.tracks = base; idle.fps = 30;
      const add = (id,name,duration,extra) => {
        const keys = new Set(extra.map(t=>t.nodeId+':'+t.property));
        const copied = base.filter(t=>!keys.has(t.nodeId+':'+t.property)).map(t=>({...t,keyframes:t.keyframes.map(v=>({...v,time:v.time/4000*duration}))}));
        project.animations.push({id,name,duration,fps:30,tracks:[...copied,...extra],audioTracks:[],loopKeyframes:true});
      };
      add('nod','轻微点头',4000,[track(head.id,'y',[[0,0],[1200,4],[2200,0],[4000,0]]),track(head.id,'scaleY',[[0,1],[1200,.985],[2200,1],[4000,1]])]);
      add('shake','轻微摇头',4000,[track(head.id,'rotation',[[0,0],[1000,-3],[2000,3],[3000,-2],[4000,0]])]);
      add('curious','歪头观察',4000,[track(head.id,'rotation',[[0,0],[1400,-4],[2600,-4],[4000,0]])]);
      add('greeting','呼吸 · 问候',4000,[track(torso.id,'scaleY',[[0,1],[1800,.99],[2800,.99],[4000,1]]),track(head.id,'y',[[0,0],[1800,4],[2800,4],[4000,0]])]);
      add('showcase','连续组合 · 待机 → 观察 → 点头 → 摇头',16000,[track(head.id,'rotation',[[0,0],[4000,0],[5500,-4],[7000,-4],[8000,0],[11500,0],[12500,-3],[13500,3],[14500,-2],[16000,0]]),track(head.id,'y',[[0,0],[8000,0],[9300,4],[10300,0],[16000,0]])]);
    });
    const project = useProjectStore.getState().project;
    const animation = project.animations.find(a=>a.id==='showcase');
    useEditorStore.getState().setShowSkeleton(false);
    useEditorStore.getState().setSkeletonEditMode(false);
    useEditorStore.getState().setEditorMode('animation');
    useAnimationStore.getState().switchAnimation(animation);
    useAnimationStore.getState().play();
    const blob = await saveProject(project);
    return {bytes:Array.from(new Uint8Array(await blob.arrayBuffer())),physicsRules:project.physicsRules ?? [],parts:project.nodes.filter(n=>n.type==='part').length,meshes:project.nodes.filter(n=>n.mesh).length,warps:project.nodes.filter(n=>n.type==='warpDeformer').length,clips:project.animations.map(a=>({id:a.id,name:a.name,duration:a.duration}))};
  });
  const zip = await JSZip.loadAsync(exported.bytes);
  const project = JSON.parse(await zip.file('project.json').async('string'));
  project.physicsRules = exported.physicsRules;
  validateNativeProject(project);
  zip.file('project.json',JSON.stringify(project));
  await writeFile(path.join(root,'public/art',name+'.stretch'),await zip.generateAsync({type:'nodebuffer'}));
  await mkdir(path.join(root,'evidence'),{recursive:true});
  await page.evaluate(async () => {
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const { useEditorStore } = await import('/vendor/stretchystudio/src/store/editorStore.js');
    const { useProjectStore } = await import('/vendor/stretchystudio/src/store/projectStore.js');
    const canvas = document.querySelector('canvas'), size = useProjectStore.getState().project.canvas;
    const zoom = Math.min(canvas.clientWidth/size.width,canvas.clientHeight/size.height)*.9;
    useEditorStore.getState().setView({zoom,panX:(canvas.clientWidth-size.width*zoom)/2,panY:(canvas.clientHeight-size.height*zoom)/2});
  });
  await page.screenshot({path:path.join(root,'evidence',name+'-editor.png')});
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(path.join(root,'evidence',name+'-import.json'),JSON.stringify({...exported,bytes:undefined,input,errors},null,2)+'\n');
  console.log(`PASS: native PSD wizard exported ${name}; ${exported.parts} parts, ${exported.meshes} meshes, ${exported.warps} warps.`);
} finally { await browser.close(); }
