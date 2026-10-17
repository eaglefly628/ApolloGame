import { describe,it,expect } from 'vitest';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { encodePngRGBA,decodePng } from './asset-matte.mjs';
import { imageMetrics,sideBySide,uiDifferences } from './lib/keyart-metrics.mjs';
import { cameraInstrumentation } from './lib/keyart-capture.mjs';
import { keyartReview,validateReviewConfig } from './keyart-review.mjs';
import { selfCheckArtifacts,aiFlowHash,gameHash,boardFor } from './game-pipeline.mjs';
const solid=(rgb,w=9,h=9)=>{const b=Buffer.alloc(w*h*4);for(let i=0;i<b.length;i+=4){rgb.forEach((v,k)=>b[i+k]=v);b[i+3]=255;}return encodePngRGBA(w,h,b);};
const red=solid([255,0,0]),blue=solid([0,0,255]);
async function fixture(fn){const root=mkdtempSync(join(tmpdir(),'aiflow-review-'));try{const dir=join(root,'docs/design/example');mkdirSync(join(dir,'keyart'),{recursive:true});writeFileSync(join(dir,'keyart/hall.png'),red);return await fn(root,dir);}finally{rmSync(root,{recursive:true,force:true});}}
describe('T6/U4/R5 evidence',()=>{
 it('客观指标按颜色和分区亮度真值变化，不含通过阈值',()=>{const same=imageMetrics(red,red);expect(same.hueHistogramDistance).toBe(0);expect(same.regions.every(r=>r.delta===0)).toBe(true);const changed=imageMetrics(red,blue);expect(changed.hueHistogramDistance).toBe(1);expect(changed.rgbHistogramDistance).toBeCloseTo(2/3,5);expect(changed.regions).toHaveLength(9);expect(changed.regions.every(r=>r.delta===-0.1404)).toBe(true);expect(changed.advisoryOnly).toBe(true);expect(changed).not.toHaveProperty('pass');expect(changed).not.toHaveProperty('threshold');});
 it('并排图左参考右截图，保留不同尺寸图',()=>{const image=decodePng(sideBySide(red,blue));expect([image.w,image.h]).toEqual([18,9]);expect([...image.rgba.subarray(0,4)]).toEqual([255,0,0,255]);expect([...image.rgba.subarray(9*4,9*4+4)]).toEqual([0,0,255,255]);expect(decodePng(sideBySide(red,solid([0,0,0],18,9))).w).toBe(27);});
 it('UI逐件给有符号位置/尺寸/颜色差，缺件明确列出',()=>{const box={id:'button',x:10,y:20,w:100,h:40,bg:'rgb(20, 40, 60)',color:'rgb(255, 255, 255)'};const diffs=uiDifferences([box,{...box,id:'gone'}],[{...box,x:15,y:18,w:105,h:30,bg:'rgb(30, 20, 65)'},{...box,id:'added'}]);expect(diffs.find(d=>d.id==='button')).toMatchObject({position:{dx:5,dy:-2},size:{dw:5,dh:-10},bg:{deltaRgb:[10,-20,5]}});expect(diffs.find(d=>d.id==='gone')).toEqual({id:'gone',missing:'actual'});expect(diffs.find(d=>d.id==='added')).toEqual({id:'added',missing:'reference'});expect(()=>uiDifferences([box,box],[])).toThrow('唯一');});
 it.each([{mode:'pass'},{viewport:{width:0,height:12}},{presets:[]},{presets:[{id:'x',frames:[10,5]}]},{presets:[{id:'x',frame:-1}]},{presets:[{id:'x',camera:{Transform:1}}]},{presets:[{id:'x',actions:[{script:'alert(1)'}]}]},{mode:'ui'},{mode:'ui',ui:{reference:'x.html',items:[]}}])('坏预设拒收 %j',config=>expect(()=>validateReviewConfig(config)).toThrow());
 it('camera instrumentation 仅处理目标模块，临时render sync确实消费机位',()=>{expect(cameraInstrumentation('unchanged','/src/renderer/three-renderer.ts')).toBe(null);const source='class Engine { attachRenderer(r) { r.sync({}); } }';const code=cameraInstrumentation(source,'/fixture/src/runtime/engine.ts');const run=new Function('window',code+'; return Engine;');const win={__aiflowCapture:{camera:{yaw:1.2,entity:'cam'}}};const Engine=run(win),engine=new Engine(),camera={yaw:0};engine.world={getComponent:(id,type)=>id==='cam'&&type==='Camera3D'?camera:null};let seen;engine.attachRenderer({sync:()=>seen=camera.yaw});expect(seen).toBe(1.2);expect(win.__aiflowCameraApplied).toBe(true);});
 it('mock序列隔离，帧数正确，不产真实门工件',async()=>fixture(async(root,dir)=>{writeFileSync(join(dir,'keyart/hall.review.json'),JSON.stringify({presets:[{id:'main',frames:[0,1,2]},{id:'side',frame:4}]}));const out=await keyartReview(root,'example','hall',{mock:true});expect(out.metrics.shots.map(s=>s.frame)).toEqual([0,1,2,4]);expect(out.metrics.mock).toBe(true);expect(out.reviewFile).toContain('/self-check/mock/');expect(existsSync(join(dir,'self-check/R1-keyart-review.md'))).toBe(false);expect(out.metrics.shots.every(s=>existsSync(join(out.shotDir,s.screenshot))&&existsSync(join(out.shotDir,s.comparison)))).toBe(true);}));
 it('真实工件落盘含hash、骨架不写判词，重跑不覆盖人工文字',async()=>fixture(async(root,dir)=>{const capture=async()=>({shots:[{preset:'main',frame:60,reference:'keyart/hall.png',buffer:blue}]});const a=await keyartReview(root,'example','hall',{capture});expect(a.metrics.mock).toBe(false);expect(a.metrics.shots[0].sha256).toMatch(/^[a-f0-9]{64}$/);const markdown=readFileSync(a.reviewFile,'utf8');expect(markdown).toContain('待复查人填写');expect(markdown).not.toMatch(/结论[：:]\s*(PASS|通过)/);writeFileSync(a.reviewFile,markdown+'\n人工差异：请保留\n');await keyartReview(root,'example','hall',{capture});expect(readFileSync(a.reviewFile,'utf8')).toBe(markdown+'\n人工差异：请保留\n');}));
 it('UI模式图像与盒子都用reference页面，不需要场景关键图',async()=>fixture(async(root,dir)=>{const box={id:'a',x:1,y:1,w:4,h:4,bg:'rgb(0,0,0)',color:'rgb(255,255,255)'};writeFileSync(join(dir,'ref.html'),'<html></html>');writeFileSync(join(dir,'keyart/ui.review.json'),JSON.stringify({mode:'ui',ui:{reference:'ref.html',items:[{id:'a',selector:'#a'}]}}));const capture=async()=>({referenceImage:red,referenceBoxes:[box],shots:[{preset:'main',frame:60,buffer:blue,boxes:[{...box,x:4}]}]});const out=await keyartReview(root,'example','ui',{capture});expect(out.metrics.shots[0].ui[0].position.dx).toBe(3);expect(out.metrics.shots[0].reference).toBe('ref.html');}));
 it('CLI mock零key零网络完成，路径逃逸非零退出',async()=>fixture(async(root)=>{const script=join(process.cwd(),'scripts/keyart-review.mjs');const r=spawnSync(process.execPath,[script,'example','hall','--root',root,'--mock'],{encoding:'utf8'});expect(r.status,r.stderr).toBe(0);const bad=spawnSync(process.execPath,[script,'../escape','hall','--root',root,'--mock'],{encoding:'utf8'});expect(bad.status).toBe(1);expect(bad.stderr).toContain('reject');}));
});

describe('C3 independent R1 evidence and C4 color comparability',()=>{
 it('C3 R1 output never satisfies the S4 five gameplay screenshots requirement',async()=>fixture(async(root,dir)=>{
  const capture=async()=>({shots:[0,1,2].map(frame=>({preset:'main',frame,reference:'keyart/hall.png',buffer:blue}))});
  const out=await keyartReview(root,'example','hall',{capture});
  expect(out.metrics.shots).toHaveLength(3);
  writeFileSync(join(dir,'self-check/S4-alignment.md'),'gameplay plan');
  expect(selfCheckArtifacts(root,'example','S4')).toMatchObject({shots:0,hasAlignment:true,ok:false});
  expect(out.shotDir).toBe(join(dir,'self-check/r1/hall'));
  expect(readFileSync(out.reviewFile,'utf8')).toContain('(r1/hall/main-0000.png)');
 }));
 it('C3 adding S4 gameplay screenshots leaves an existing independent R1 review fresh',async()=>fixture(async(root,dir)=>{
  await keyartReview(root,'example','hall',{capture:async()=>({shots:[{preset:'main',frame:0,reference:'keyart/hall.png',buffer:blue}]})});
  const hash=aiFlowHash(root,'example','R1');
  mkdirSync(join(root,'public/games/example'),{recursive:true});
  writeFileSync(join(root,'public/games/example/pipeline.json'),JSON.stringify({reviews:{R1:{by:'Claude',builder:'Codex',verdict:'CONCERNS',gameHash:gameHash(root,'example'),artifactHash:hash}}}));
  const review=()=>boardFor(root,'example').stages.find(s=>s.id==='R1').review.state;
  expect(review()).toBe('ok');
  mkdirSync(join(dir,'self-check/shots/s4'),{recursive:true});
  for(let i=0;i<6;i++)writeFileSync(join(dir,`self-check/shots/s4/${i}.png`),red);
  expect(aiFlowHash(root,'example','R1')).toBe(hash);expect(review()).toBe('ok');
  writeFileSync(join(dir,'self-check/r1/hall/main-0000.png'),red);
  expect(review()).toBe('stale');
 }));
 it.each(['rgba(0,0,0,0)','rgba(0,0,0,0.5)','rgb(0 0 0 / 50%)','#00000000'])('C4 alpha below one is incomparable: %s',bg=>{
  const box={id:'a',x:0,y:0,w:1,h:1,color:'rgb(255,255,255)'};
  const diff=uiDifferences([{...box,bg}],[{...box,bg:'rgb(100,10,20)'}])[0];
  expect(diff.bg).toMatchObject({comparable:false,deltaRgb:null});expect(diff.bg.reason).toContain('不可比');
  const reverse=uiDifferences([{...box,bg:'rgb(100,10,20)'}],[{...box,bg}])[0];expect(reverse.bg.deltaRgb).toBe(null);
 });
 it('C4 alpha one remains comparable and retains signed color differences',()=>{
  const box={id:'a',x:0,y:0,w:1,h:1,bg:'rgba(0,0,0,1)',color:'rgb(255,255,255)'};
  expect(uiDifferences([box],[{...box,bg:'rgb(100,10,20)'}])[0].bg).toMatchObject({comparable:true,reason:null,deltaRgb:[100,10,20]});
 });
});
