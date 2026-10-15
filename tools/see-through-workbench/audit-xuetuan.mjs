import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.dirname(fileURLToPath(import.meta.url));
const name = 'xuetuan-layered-v1';
const base = process.env.NATIVE_CHARACTER_URL ?? 'http://127.0.0.1:5182';
const digest = uri => createHash('sha256').update(Buffer.from(uri.split(',')[1],'base64')).digest('hex');
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:[]});
try {
  const engine=await browser.newPage({viewport:{width:900,height:900}});
  const errors=[];engine.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
  engine.on('console',m=>{if(m.type()==='error')console.error(m.text());});
  engine.on('requestfailed',r=>console.error('request failed',r.url(),r.failure()?.errorText));
  await engine.goto(`${base}/engine.html?asset=native-character-demo&clip=showcase`);
  try { await engine.waitForFunction(()=>!!window.apolloCharacterReady,{},{timeout:15000}); } catch(e) {console.error('BODY',await engine.locator('body').innerText());await engine.screenshot({path:path.join(root,'evidence/xuetuan-startup-error.png')});throw e;}
  await engine.evaluate(()=>window.apolloCharacterReady);
  await engine.evaluate(async name=>{await window.apolloCharacter.command({type:'load',bytes:await(await fetch('/art/'+name+'.stretch')).arrayBuffer()});await window.apolloCharacter.command({type:'play',clipId:'showcase'});},name);
  await engine.evaluate(()=>window.apolloCharacter.command({type:'pause'}));
  const native=await browser.newPage({viewport:{width:1100,height:1000}});
  native.on('pageerror',e=>errors.push(e.message));
  await native.goto(`${base}/reference.html?mode=player`);
  const size=await native.evaluate(async name=>{
    const {loadProject}=await import('/vendor/stretchystudio/src/io/projectFile.js');
    const {useProjectStore}=await import('/vendor/stretchystudio/src/store/projectStore.js');
    const {useAnimationStore}=await import('/vendor/stretchystudio/src/store/animationStore.js');
    const {useEditorStore}=await import('/vendor/stretchystudio/src/store/editorStore.js');
    const {useParameterStore}=await import('/vendor/stretchystudio/src/store/parameterStore.js');
    const bytes=await(await fetch(`/art/${name}.stretch`)).arrayBuffer();
    const {project}=await loadProject(new File([bytes],name+'.stretch'));
    useProjectStore.getState().loadProject(project);useParameterStore.getState().resetToDefaults(project.parameters);
    useEditorStore.getState().setEditorMode('animation');useEditorStore.getState().setShowSkeleton(false);useEditorStore.getState().setSelection([]);
    const clip=project.animations.find(a=>a.id==='showcase');useAnimationStore.getState().switchAnimation(clip);useAnimationStore.getState().pause();
    document.querySelector('canvas').style.cssText='position:fixed;width:600px;height:760px;left:0;top:0';
    window.nativeGenerated={useAnimationStore,useEditorStore};return project.canvas;
  },name);
  await native.waitForTimeout(300);
  await native.evaluate(size=>{
    const zoom=Math.min(600/size.width,760/size.height)*.9;
    window.nativeGenerated.useEditorStore.getState().setView({zoom,panX:(600-size.width*zoom)/2,panY:(760-size.height*zoom)/2});
  },size);
  const comparisons=[];
  for(const timeMs of [0,6040,13000]){
    const actual=await engine.evaluate(async timeMs=>{await window.apolloCharacter.command({type:'seek',timeMs});return window.apolloCharacter.command({type:'capture'});},timeMs);
    const expected=await native.evaluate(async timeMs=>{window.nativeGenerated.useAnimationStore.getState().seekTime(timeMs);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.querySelector('canvas').toDataURL('image/png');},timeMs);
    assert.equal(digest(actual),digest(expected),`Native/engine differ at ${timeMs} ms`);
    comparisons.push({timeMs,nativeSha256:digest(expected),engineSha256:digest(actual),identical:true});
    await writeFile(path.join(root,'evidence',`${name}-${timeMs}.png`),Buffer.from(actual.split(',')[1],'base64'));
  }
  assert.notEqual(comparisons[0].engineSha256,comparisons[1].engineSha256,'Blink must change the image');
  assert.notEqual(comparisons[0].engineSha256,comparisons[2].engineSha256,'Combined head motion must change the image');
  assert.deepEqual(errors,[]);
  await writeFile(path.join(root,'evidence',name+'-runtime.json'),JSON.stringify({asset:name,comparisons,browserErrors:errors},null,2)+'\n');
  console.log(`PASS: generated ${name}, native and engine frames identical at 3 times; blink and combined motion change frames.`);
  await engine.evaluate(()=>window.apolloCharacter.command({type:'play',clipId:'controls'}));
  await engine.evaluate(()=>window.apolloCharacter.command({type:'pause'}));
  const status=await engine.evaluate(()=>window.apolloCharacter.command({type:'status'}));
  const defaults=Object.fromEntries(status.parameters.map(p=>[p.id,p.default??0]));
  const extremes=[];
  for(const parameter of status.parameters){
    const hashes=[];
    for(const value of [parameter.min,parameter.max]){
      const uri=await engine.evaluate(async values=>{await window.apolloCharacter.command({type:'parameters',values});return window.apolloCharacter.command({type:'capture'});},{...defaults,[parameter.id]:value});
      hashes.push(digest(uri));
      await writeFile(path.join(root,'evidence',name+'-'+parameter.id+'-'+value+'.png'),Buffer.from(uri.split(',')[1],'base64'));
    }
    assert.notEqual(hashes[0],hashes[1],parameter.id+' must affect actual pixels');
    extremes.push({id:parameter.id,min:parameter.min,max:parameter.max,hashes});
  }
  await engine.evaluate(values=>window.apolloCharacter.command({type:'parameters',values}),defaults);
  await engine.evaluate(()=>window.apolloCharacter.command({type:'play',clipId:'showcase'}));
  await engine.evaluate(()=>window.apolloCharacter.command({type:'pause'}));
  await mkdir(path.join(root,'workspace',name+'-frames'),{recursive:true});
  for(let frame=0;frame<80;frame++){
    const uri=await engine.evaluate(async timeMs=>{await window.apolloCharacter.command({type:'seek',timeMs});return window.apolloCharacter.command({type:'capture'});},frame*200);
    await writeFile(path.join(root,'workspace',name+'-frames',String(frame).padStart(3,'0')+'.png'),Buffer.from(uri.split(',')[1],'base64'));
  }
  await writeFile(path.join(root,'evidence',name+'-parameters.json'),JSON.stringify({extremes,browserErrors:errors,exportedFrames:80,pendingHumanReview:true},null,2)+'\n');
  console.log(`PASS: ${status.parameters.length} parameters change rendered pixels; 80 native frames exported.`);

}finally{await browser.close()}
