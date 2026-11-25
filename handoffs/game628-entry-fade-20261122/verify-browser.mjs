import assert from 'node:assert/strict';
import {mkdir,rename,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const base='http://127.0.0.1:18857';
const evidence=new URL('./evidence/',import.meta.url);
await mkdir(evidence,{recursive:true});
const videoDir=fileURLToPath(evidence);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=metal']});
const dims={width:1280,height:720};
const streetModel='**/street-reference-v4.glb';
const get=(page,name)=>page.getByRole('button',{name,exact:true});
const outerState=(page,state)=>page.waitForFunction(state=>document.querySelector('#entry-curtain')?.dataset.state===state,state);
const rootReady=page=>page.waitForFunction(()=>{
  const preview=document.querySelector('#preview');
  return window.document.querySelector('#entry').dataset.screen==='street' &&
    preview?.contentWindow?.apolloPrototype &&
    document.querySelector('#entry-curtain')?.hidden!==false;
},null,{timeout:25000});
const enterFace=async(page,url)=>{
  await page.goto(url);
  await get(page,'游客进入').click();
  await page.waitForFunction(()=>!document.querySelector('#confirm')?.disabled && !!document.querySelector('#confirm'),null,{timeout:28000});
};
const inspect=page=>page.evaluate(()=>{
  const curtain=document.querySelector('#entry-curtain');
  const preview=document.querySelector('#preview');
  const doc=preview?.contentDocument;
  const canvas=doc?.querySelector('canvas');
  return {state:curtain?.dataset.state,hidden:curtain?.hidden,opacity:curtain?getComputedStyle(curtain).opacity:null,
    screen:document.querySelector('#entry')?.dataset.screen,scene:doc?.documentElement.dataset.firstSceneFrame,
    query:preview?.contentWindow?.location.search,stats:preview?.contentWindow?.apolloPrototype?.stats(),
    canvas:canvas&&[canvas.clientWidth,canvas.clientHeight,canvas.width,canvas.height]};
});
function holdModel(page){
  let arrived,release;
  const hit=new Promise(resolve=>arrived=resolve);
  const held=new Promise(resolve=>release=resolve);
  const route=async request=>{arrived();await held;await request.continue();};
  return {hit,release,install:()=>page.route(streetModel,route),remove:()=>page.unroute(streetModel,route)};
}
async function audit(page) {
  await page.evaluate(()=>{
    window.transitionAudit=[];
    const curtain=document.querySelector('#entry-curtain');
    const sample=()=>{
      const child=document.querySelector('#preview').contentDocument;
      const state=curtain.dataset.state??'idle';
      window.transitionAudit.push({t:performance.now(),state,opacity:getComputedStyle(curtain).opacity,hidden:curtain.hidden,
        scene:child?.documentElement.dataset.firstSceneFrame??null});
    };
    new MutationObserver(sample).observe(curtain,{attributes:true});
    sample();
  });
}
async function videoCase(url,name,newBuild){
  const context=await browser.newContext({viewport:dims,recordVideo:{dir:videoDir,size:dims}});
  const page=await context.newPage();
  const faults=[];
  page.on('console',event=>{if(event.type()==='error'||event.text().includes('[scene:ready]'))faults.push(event.text());});
  page.on('pageerror',error=>faults.push(error.message));
  page.on('response',response=>{if(response.status()>=400)faults.push(response.status()+' '+response.url());});
  console.log('START '+name);
  await enterFace(page,url);
  if(newBuild) await audit(page);
  const gate=holdModel(page);
  await gate.install();
  await get(page,'确认角色').click();
  const limit=AbortSignal.timeout(18000);
  await Promise.race([gate.hit,new Promise((_,reject)=>limit.addEventListener('abort',()=>reject(Error('Street model was not requested'))))]);
  if(newBuild)await outerState(page,'loading');
  const held=await inspect(page);
  if(newBuild) {
    assert.equal(held.opacity,'1');
    assert.equal(held.hidden,false);
    assert.equal(held.scene,undefined);
  }
  // Identical hold on the baseline and candidate, only to make the controlled
  // slow transport visible in the exported recordings.
  await page.waitForTimeout(1200);
  await page.screenshot({path:fileURLToPath(new URL(name+'-held.jpg',evidence))});
  gate.release();
  await rootReady(page).catch(async error=>{
    faults.push(String(error),JSON.stringify(await inspect(page)));
    await page.screenshot({path:fileURLToPath(new URL(name+'-failed.jpg',evidence))});
    await writeFile(new URL(name+'-errors.json',evidence),JSON.stringify(faults,null,2));
    const video=page.video();
    await context.close();
    await rename(await video.path(),fileURLToPath(new URL(name+'-failed.webm',evidence)));
    throw error;
  });
  const revealed=await inspect(page);
  const trace=newBuild?await page.evaluate(()=>window.transitionAudit):[];
  if(newBuild){
    assert.equal(revealed.scene,'crowd-street');
    assert.ok(revealed.stats.models>=10);
    assert.ok(revealed.stats.triangles>0);
    const states=trace.map(event=>event.state);
    for(const s of ['covering','loading','revealing'])assert.ok(states.includes(s),JSON.stringify(trace));
    const unveiling=trace.find(event=>event.state==='revealing');
    assert.equal(unveiling.scene,'crowd-street');
    assert.ok(trace.at(-1).t-unveiling.t>=450,JSON.stringify(trace));
  }
  await page.screenshot({path:fileURLToPath(new URL(name+'-revealed.jpg',evidence))});
  const video=page.video();
  await context.close();
  await rename(await video.path(),fileURLToPath(new URL(name+'.webm',evidence)));
  return {held,revealed,trace};
}
const results={};
try{
  results.guestSlow=await videoCase(base+'/','after-18857',true);
  const page=await browser.newPage({viewport:dims});
  const gate=holdModel(page);
  await gate.install();
  await page.goto(base+'/prototype?scene=crowd-street');
  await gate.hit;
  const before=await page.locator('#scene-curtain').evaluate(c=>[c.dataset.state,c.hidden,getComputedStyle(c).opacity]);
  assert.deepEqual(before,['loading',false,'1']);
  gate.release();
  await page.waitForFunction(()=>document.querySelector('#scene-curtain').dataset.state==='ready',null,{timeout:25000});
  results.directCold={before,scene:await page.locator('html').getAttribute('data-first-scene-frame')};
  await gate.remove();
  await page.close();

  const repeat=await browser.newPage({viewport:dims,reducedMotion:'reduce'});
  await enterFace(repeat,base+'/');
  await audit(repeat);
  let rejected=0;
  await repeat.route(streetModel,async route=>{
    if(!rejected++){await route.fulfill({status:503,body:'QA forced model failure'});}
    else await route.continue();
  });
  await get(repeat,'确认角色').click();
  await outerState(repeat,'failed');
  const failures=await repeat.getByRole('alert').innerText();
  assert.ok(failures.includes('请重试'));
  assert.equal(await repeat.locator(':focus').getAttribute('id'),'entry-retry');
  await get(repeat,'重试').click();
  await rootReady(repeat);
  const first=await inspect(repeat);
  assert.equal(first.scene,'crowd-street');
  await get(repeat,'菜单').click();
  await get(repeat,'返回标题').click();
  await get(repeat,'游客进入').click();
  await repeat.waitForFunction(()=>document.querySelector('#confirm')?.disabled===false);
  await get(repeat,'确认角色').click();
  await rootReady(repeat);
  const second=await inspect(repeat);
  assert.notEqual(first.query,second.query);
  const spans=await repeat.evaluate(()=>{
    const trace=window.transitionAudit;
    return trace.flatMap((event,i)=>event.state==='revealing'&&trace[i+1]?.hidden?[trace[i+1].t-event.t]:[]);
  });
  assert.ok(spans.length>=2 && spans.every(ms=>ms<200),JSON.stringify(spans));
  results.failureRetryRepeatReduced={failures,rejected,first,second,spans};
  await repeat.close();
  try{results.baseline=await videoCase('http://127.0.0.1:18855/','before-18855',false);}
  catch(error){results.baselineError=String(error);}
  await writeFile(new URL('browser.json',evidence),JSON.stringify(results,null,2)+'\n');
  console.log('PASS baseline and fade footage, guest slow load, cold launch, asset failure/retry, repeat and reduced motion');
}catch(error){
  await writeFile(new URL('browser-partial.json',evidence),JSON.stringify(results,null,2)+'\n');
  throw error;
}finally{
  await browser.close();
}
