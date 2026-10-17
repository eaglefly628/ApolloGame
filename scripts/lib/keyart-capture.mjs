// Ephemeral authoring harness. No persistent engine or game source is changed.
import { existsSync, realpathSync, mkdtempSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createServer, optimizeDeps } from 'vite';
import { tmpdir } from 'node:os';
import { createDesignRequestHandler } from '../design-measure.mjs';
import { detectBrowserRuntime } from './render-harness.mjs';
import { inside } from './aiflow-paths.mjs';
import { installDesignResources } from './design-resources.mjs';
async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' 超时（30s）')),30000);})]);}finally{clearTimeout(timer);}}
const EPOCH=Date.UTC(2026,0,1);
// Applied only by the capture server, only around render sync, only to Camera3D fields.
export function cameraInstrumentation(code,id){
  if(!id.split('?')[0].replaceAll('\\','/').endsWith('/src/runtime/engine.ts'))return null;
  return code+`\nconst __aiflowAttach = Engine.prototype.attachRenderer;
Engine.prototype.attachRenderer = function(renderer, container) {
  const engine=this, sync=renderer.sync.bind(renderer);
  renderer.sync=function(world) {
    const preset=window.__aiflowCapture?.camera;
    if(preset) {
      const {entity='cam',...fields}=preset;
      const camera=engine.world.getComponent(entity,'Camera3D');
      if(!camera)throw new Error('aiflow: Camera3D entity missing: '+entity);
      Object.assign(camera,fields);window.__aiflowCameraApplied=true;
    }
    return sync(world);
  };
  return __aiflowAttach.call(this,renderer,container);
};\n`;
}
async function prepare(page,url,preset,config){
  await page.clock.install({time:EPOCH});await page.clock.pauseAt(EPOCH);
  await installDesignResources(page,new URL(url).origin);
  await page.addInitScript(({camera})=>{window.__aiflowCapture={camera};let seed=123456789;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};},{camera:preset.camera??null});
  await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith(new URL(url).origin+'/')||u.startsWith('data:')||u.startsWith('blob:'))return route.continue();console.warn('[keyart-review] skip: 外部网络请求已阻止 '+new URL(u).hostname);return route.abort();});
  await page.goto(url,{waitUntil:'load',timeout:30000});
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(0);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{throw new Error('图片加载失败: '+i.getAttribute('src'));})));});
  for(const action of preset.actions??[]){if(action.click){const item=page.locator(action.click);if(await item.count()!==1)throw new Error(`click 目标必须唯一: ${action.click}`);await item.click({force:true});}else await page.keyboard.press(action.key);}
  await page.addStyleTag({content:'* { caret-color:transparent !important; transition:none !important; }'});
}
export async function captureFrames(root,slug,scene,config,{measurePage}={}) {
  root=realpathSync(root); // Vite HTML proxy cache keys must use the canonical root on macOS /var symlinks.
  const runtime=detectBrowserRuntime();if(!runtime.ok){console.error(`[keyart-review] reject: ${runtime.reason}`);throw new Error('NO_BROWSER: 配置 RENDER_PROBE_CHROMIUM，或显式 --mock');}
  const {chromium}=await import('playwright');let server,browser;const cache=mkdtempSync(join(tmpdir(),'aiflow-vite-cache-'));const hasConfig=existsSync(join(root,'vite.config.ts'));const vendorHandler=createDesignRequestHandler(root,process.env.DC_VENDOR??'');
  try{
    server=await createServer({root,cacheDir:cache,configFile:hasConfig?undefined:false,...(hasConfig?{optimizeDeps:{entries:['index.html'],noDiscovery:true,include:['react','react-dom/client','react/jsx-runtime','three/addons/loaders/HDRLoader.js','three/addons/objects/Reflector.js']}}:{}),plugins:[{name:'aiflow-camera',enforce:'post',transform:cameraInstrumentation,configureServer(server){server.middlewares.use((req,res,next)=>req.url?.startsWith('/__vendor/')?vendorHandler(req,res):next());}}],server:{host:'127.0.0.1',port:0,hmr:false}});if(hasConfig)await optimizeDeps(server.config);await server.listen();
    const base=`http://127.0.0.1:${server.httpServer.address().port}`;
    const target=config.entry?'/'+relative(root,inside(root,config.entry)).split('\\').join('/'):`/?game=${encodeURIComponent(existsSync(join(root,'library',slug,'manifest.json'))?'lib:'+slug:slug)}`;
    browser=await chromium.launch({headless:true,executablePath:runtime.execPath,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']});
    const results=[];
    for(const preset of config.presets){
      const shots=[];
      // Independent reloads verify repeatability; never label a changing scene deterministic.
      for(let repeat=0;repeat<2;repeat++){
        const page=await browser.newPage({viewport:config.viewport,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
        try{
          await bounded(prepare(page,base+target,preset,config),'capture prepare');
          let previous=0;
          for(const frame of preset.frames??[preset.frame]){
            await page.clock.runFor((frame-previous)*1000/60);previous=frame;
            await page.evaluate(ms=>{for(const a of document.getAnimations()){a.pause();a.currentTime=ms;}},frame*1000/60);
            if(errors.length)throw new Error('页面错误: '+errors.join('; '));
            if(preset.camera&&!await page.evaluate(()=>window.__aiflowCameraApplied))throw new Error('Camera3D 预设未消费，拒绝冒充机位截图');
            const buffer=await page.screenshot({type:'png',animations:'allow'});
            const boxes=config.mode==='ui'?(await measurePage(page,{width:config.ui.canvas.width,height:config.ui.canvas.height,stageSelector:config.ui.canvas.selector,items:config.ui.items.map(({id,selector,actualSelector})=>({id,selector:actualSelector??selector}))})).boxes:null;
            if(repeat===0)shots.push({preset:preset.id,frame,buffer,boxes,reference:preset.reference??`keyart/${scene}.png`});
            else if(!shots.find(s=>s.frame===frame).buffer.equals(buffer))throw new Error(`${preset.id}/${frame}: 两次截图不一致`);
          }
        }finally{await page.close();}
      }
      results.push(...shots);
    }
    let referenceBoxes=null,referenceImage=null;
    if(config.mode==='ui'){
      const path=inside(join(root,'docs/design',slug),config.ui.reference);
      const page=await browser.newPage({viewport:config.viewport,deviceScaleFactor:1});
      try{await bounded(prepare(page,base+'/'+relative(root,path).split('\\').join('/'),{},config),'UI reference prepare');referenceBoxes=(await measurePage(page,{width:config.ui.canvas.width,height:config.ui.canvas.height,stageSelector:config.ui.canvas.selector,items:config.ui.items.map(({id,selector})=>({id,selector}))})).boxes;referenceImage=await page.screenshot({type:'png',animations:'allow'});}finally{await page.close();}
    }
    console.info(`[keyart-review] decision: ${results.length} 帧，重复截图逐字节一致`);
    return {shots:results,referenceBoxes,referenceImage};
  }finally{if(browser)await browser.close();if(server)await server.close();rmSync(cache,{recursive:true,force:true});}
}
