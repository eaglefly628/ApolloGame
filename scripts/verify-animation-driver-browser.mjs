#!/usr/bin/env node
// Browser evidence for M3.5 D1. Generates only synthetic fixture bytes outside Git.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,symlinkSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';import {dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {createServer} from 'vite';import {chromium} from 'playwright';
import {engineAliases} from './engine-aliases.mjs';import {makeMockCharacterGlb} from './fixtures/character-pipeline/mock-character.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url))),dir=realpathSync(mkdtempSync(join(tmpdir(),'apollo-d1-browser-'))),publicDir=join(dir,'public');
mkdirSync(join(publicDir,'fixtures'),{recursive:true});symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'dir');
const assets=[],inputs={};
for(const [id,name,clipName] of [['model/probe','model',undefined],['motion/probe','motion','probe']]){const bytes=makeMockCharacterGlb({clipName});writeFileSync(join(publicDir,'fixtures',name+'.glb'),bytes);inputs[id]=createHash('sha256').update(bytes).digest('hex');assets.push({id,type:clipName?'animation':'mesh',description:'Synthetic D1 triangle fixture only',status:'filled',path:'fixtures/'+name+'.glb',...(clipName?{spec:{skeleton:'apollo-humanoid-v1',fps:30,frames:31,loop:false}}:{})});}
writeFileSync(join(publicDir,'fixtures/index.json'),JSON.stringify({version:1,assets,groups:{cast:assets.map(a=>a.id)},initialGroup:'cast'}));
writeFileSync(join(dir,'index.html'),'<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#101725"><div id="stage" style="width:720px;height:480px"></div><script type="module" src="/probe.js"></script></body></html>');
writeFileSync(join(dir,'probe.js'),`import ${JSON.stringify(join(root,'scripts/fixtures/animation-driver/browser-probe.mjs'))};`);
let server,browser;const report={ok:false,evidence:dir,source:'synthetic-triangle-rig',realMixamoValidated:false,inputs,diagnostics:[]};
try{
 server=await createServer({configFile:false,root:dir,publicDir,resolve:{alias:engineAliases(root)},server:{host:'127.0.0.1',port:0,fs:{allow:[dir,root]}},logLevel:'error'});await server.listen();
 browser=await chromium.launch({executablePath:process.env.RENDER_PROBE_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:720,height:480}});page.on('pageerror',e=>report.diagnostics.push('pageerror: '+e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))report.diagnostics.push(m.type()+': '+m.text());});
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port);await page.waitForFunction(()=>!!window.d1Probe);report.result=await page.evaluate(()=>window.d1Probe.run());
 assert.equal(report.result.ok,true);assert.deepEqual(report.diagnostics,[]);await page.screenshot({path:join(dir,'d1.png')});report.result.instanceCleanup=await page.evaluate(()=>window.d1Probe.cleanup());await page.evaluate(()=>window.d1Probe.dispose());report.ok=true;
}catch(error){report.error=String(error.stack??error);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:join(dir,'failure.png')}).catch(()=>{});}
finally{writeFileSync(join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await server?.close();}
console.log(JSON.stringify({ok:report.ok,report:join(dir,'report.json'),error:report.error},null,2));if(!report.ok)process.exitCode=1;
