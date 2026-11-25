import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const out = new URL('./evidence/',import.meta.url);
await mkdir(out,{recursive:true});
const browser = await chromium.launch({
  executablePath:process.env.RENDER_PROBE_CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless:process.env.G628_HEADED!=='1',args:['--enable-unsafe-swiftshader'],
});
const url='http://127.0.0.1:18844/';
const results=[];
const frameSnap=page=>page.evaluate(()=>({
  width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth,
  fullscreen:document.fullscreenElement?.tagName ?? null,focus:document.activeElement?.id,
}));
async function measure(page,selector,parent=null){
  const loc=parent ? page.frameLocator('#preview').locator(selector) : page.locator(selector);
  const box=await loc.boundingBox();
  assert.ok(box,selector);
  const viewport=await frameSnap(page);
  assert.ok(box.x>=-1&&box.x+box.width<=viewport.width+1,JSON.stringify({selector,box,viewport}));
  assert.ok(box.y>=-1&&box.y+box.height<=viewport.height+1,JSON.stringify({selector,box,viewport}));
  return {selector,...box};
}
const centered=(box,width)=>assert.ok(Math.abs(box.x+box.width/2-width/2)<2,JSON.stringify({box,width}));
async function capture(page,report,name){
  const viewport=await frameSnap(page);
  const filename=`${report.requested.width}x${report.requested.height}-${name}.png`;
  let buffer;
  if(viewport.width>=5000){
    const cdp=await page.context().newCDPSession(page);
    try{
      const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,optimizeForSpeed:true,clip:{x:0,y:0,width:viewport.width,height:viewport.height,scale:1}});
      buffer=Buffer.from(data,'base64');
      await writeFile(new URL(filename,out),buffer);
    }finally{await cdp.detach();}
  }else buffer=await page.screenshot({path:new URL(filename,out).pathname,timeout:45000});
  const pixels=[buffer.readUInt32BE(16),buffer.readUInt32BE(20)];
  assert.deepEqual(pixels,[viewport.width,viewport.height]);
  assert.equal(viewport.scrollWidth,viewport.width);
  report.screens.push({name,filename,viewport,pixels});
}
function focusId(page,id){
  return page.waitForFunction(expected=>document.activeElement?.id===expected,id,{timeout:3000});
}
async function run(size){
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1});
  page.setDefaultTimeout(26000);
  const report={requested:size,browser:browser.version(),screens:[],errors:[],failures:[],measurements:{}};
  report.console=[];
  page.on('console',m=>{if(['info','error'].includes(m.type()))report.console.push(m.text());});
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)report.failures.push([r.status(),new URL(r.url()).pathname]);});
  try{
    await page.goto(url);
    await page.locator('#start').waitFor();
    const ultra=size.width/size.height>=2;
    const home=report.measurements.home=await measure(page,'#home-card');
    assert.ok(home.width>=250&&home.width<=470);
    if(ultra)centered(home,size.width);
    if(size.width===2560)assert.ok(home.x<250,'16:9 entry keeps established left position');
    await capture(page,report,'home');
    await page.keyboard.press('Tab');await focusId(page,'start');
    await page.keyboard.press('Enter');await focusId(page,'login-confirm');
    const login=report.measurements.login=await measure(page,'#login-card');
    if(ultra)centered(login,size.width);
    await capture(page,report,'login');
    await page.keyboard.press('Enter');
    await page.locator('#confirm:enabled').waitFor();
    const frame=page.frameLocator('#preview');
    await frame.locator('#eyes-1').click();
    const faceFrame=page.frames().find(f=>f.url().includes('face-studio'));
    await faceFrame.waitForFunction(()=>Object.entries(window.apolloPrototype.snapshot()).some(([id,entity])=>/^face-1[0-2]{3}$/.test(id)&&entity.Visibility?.visible));
    const face=report.measurements.face=await measure(page,'#face-card');
    centered(face,size.width);assert.ok(face.width<=650);
    if(ultra){
      for(const id of ['#header','#footer']){
        const box=await measure(page,id,true);
        centered(box,size.width);assert.ok(box.width<=761);
      }
    }
    await capture(page,report,'face');
    await page.locator('#confirm').click();
    await page.locator('#entry[data-confirmed-face^="1"][data-screen="street"]').waitFor();
    await page.locator('#instructions').waitFor();
    const world=report.measurements.iframe=await measure(page,'#preview');
    assert.equal(world.width,size.width);
    const hud=report.measurements.hud=await measure(page,'#street-card');
    centered(hud,size.width);assert.ok(hud.width<=650);
    await capture(page,report,'street');
    await page.locator('#preview').focus();
    await page.keyboard.press('Escape');await focusId(page,'continue');
    const menu=report.measurements.menu=await measure(page,'#menu-card');
    centered(menu,size.width);assert.ok(menu.width<=370);
    await page.keyboard.press('Shift+Tab');await focusId(page,'title');
    await page.keyboard.press('Tab');await focusId(page,'continue');
    await capture(page,report,'menu');
    await page.keyboard.press('Tab');await focusId(page,'settings');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#gain input').evaluate(el=>el===document.activeElement),true);
    const settings=report.measurements.settings=await measure(page,'#settings-card');
    centered(settings,size.width);assert.ok(settings.width<=370);
    await page.keyboard.press('Shift+Tab');await focusId(page,'return-settings');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#gain input').evaluate(el=>el===document.activeElement),true);
    await capture(page,report,'settings');
    if(size.width===3440){
      const steps=[{width:5120,height:1440},{width:390,height:844},size];
      report.liveResize=[];
      for(const step of steps){
        await page.setViewportSize(step);
        const viewport=await frameSnap(page);
        assert.deepEqual([viewport.width,viewport.height],[step.width,step.height]);
        const card=await measure(page,'#settings-card');
        centered(card,step.width);
        assert.equal(await page.locator('#gain input').evaluate(el=>el===document.activeElement),true);
        report.liveResize.push({viewport,card,focus:'gain input'});
      }
      if(process.env.G628_SKIP_FULLSCREEN==='1'){
        report.fullscreen={skipped:true};
      }else{
      await page.bringToFront();
      await page.locator('#sound').evaluate(el=>{
        el.addEventListener('click',()=>{
          window.fullscreenResult=document.documentElement.requestFullscreen().then(()=>({ok:true}), error=>({ok:false,error:String(error)}));
        },{once:true});
      });
      await page.locator('#sound').click();
      const fullscreenResult=await page.evaluate(()=>Promise.race([window.fullscreenResult,new Promise(resolve=>setTimeout(()=>resolve({ok:false,error:'Fullscreen transition did not settle'}),6000))]));
      report.fullscreen=fullscreenResult;
      assert.deepEqual(fullscreenResult,{ok:true});
      await page.waitForFunction(()=>!!document.fullscreenElement);
      centered(await measure(page,'#settings-card'),(await frameSnap(page)).width);
      await capture(page,report,'fullscreen');
      await page.evaluate(()=>document.exitFullscreen());
      await page.waitForFunction(()=>!document.fullscreenElement);
      await capture(page,report,'fullscreen-exit');
      }
    }
    await page.keyboard.press('Escape');await focusId(page,'settings');
    await page.keyboard.press('Escape');await focusId(page,'preview');
    await page.locator('#settings').click();
    await page.keyboard.press('Escape');await focusId(page,'settings');
    await page.locator('#menu').click();
    await page.keyboard.press('Shift+Tab');await focusId(page,'title');
    await page.keyboard.press('Enter');await focusId(page,'start');
    assert.deepEqual(report.errors,[]);
    assert.deepEqual(report.failures,[]);
    report.ok=true;
    console.log(`PASS ${size.width}×${size.height} · ${report.screens.length} screenshots`);
  }catch(error){
    report.error=String(error.stack??error);
    report.final=await page.evaluate(()=>({screen:document.querySelector('#entry')?.dataset,chrome:document.querySelector('#chrome')?.innerText,frame:document.querySelector('#preview')?.src})).catch(()=>null);
    console.error(`FAIL ${size.width}×${size.height}`,error);
  }finally{
    results.push(report);
    await page.close();
  }
}
try{
  for(const [width,height] of (process.argv.length>2 ? process.argv.slice(2).map(s=>s.split('x').map(Number)) : [[2560,1440],[3440,1440],[5120,1440],[390,844]])){
    await run({width,height});
  }
}finally{
  await writeFile(new URL(process.argv.length>2?'verification-'+process.argv.slice(2).join('-')+'.json':'verification.json',out),JSON.stringify(results,null,2)+'\n');
  await browser.close();
}
if(results.some(report=>!report.ok))process.exitCode=1;
