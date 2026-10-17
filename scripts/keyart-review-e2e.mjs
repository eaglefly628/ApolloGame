// Real local browser verification; isolated fixture source, never a game-layer change.
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keyartReview } from './keyart-review.mjs';
import { encodePngRGBA } from './asset-matte.mjs';
const root=mkdtempSync(join(tmpdir(),'aiflow-browser-'));
const put=(p,s)=>{const path=join(root,p);mkdirSync(join(path,'..'),{recursive:true});writeFileSync(path,s);};
try{
 put('src/runtime/engine.ts',`export class Engine { constructor(){ this.camera={yaw:0}; this.world={getComponent:()=>this.camera}; } attachRenderer(renderer){ renderer.sync({}); } }`);
 put('scene.html',`<html><head><style>body{margin:0}</style></head><body><canvas width="200" height="120"></canvas><script type="module">import {Engine} from '/src/runtime/engine.ts';const e=new Engine(),c=document.querySelector('canvas').getContext('2d');let frame=0;const renderer={sync(){c.fillStyle='#12202e';c.fillRect(0,0,200,120);c.fillStyle=e.camera.yaw===1?'#ff8833':'#3388ff';c.fillRect(20+frame,30,30,30);}};e.attachRenderer(renderer);function loop(){frame++;renderer.sync();requestAnimationFrame(loop);}requestAnimationFrame(loop);</script></body></html>`);
 const rgba=Buffer.alloc(200*120*4,255);put('docs/design/example/keyart/hall.png',encodePngRGBA(200,120,rgba));
 put('docs/design/example/keyart/hall.review.json',JSON.stringify({entry:'scene.html',viewport:{width:200,height:120},presets:[{id:'main',frames:[0,1,3],camera:{entity:'cam',yaw:1}},{id:'side',frame:3,camera:{entity:'cam',yaw:2}}]}));
 const scene=await keyartReview(root,'example','hall');assert.equal(scene.metrics.shots.length,4);assert.notEqual(scene.metrics.shots[0].sha256,scene.metrics.shots[2].sha256);assert.notEqual(scene.metrics.shots[2].sha256,scene.metrics.shots[3].sha256);assert.ok(existsSync(scene.reviewFile));console.log('BROWSER: fixed frames repeated identically; motion and Camera3D presets change captured pixels');
 const html=(id,x,y,w,h,color)=>`<html><head><style>body{margin:0}#stage{position:relative;width:200px;height:120px;background:white}button{position:absolute;border:0;padding:0;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${color};color:rgb(255,255,255)}</style></head><body><div id="stage"><button id="${id}">Go</button></div></body></html>`;
 put('actual.html',html('actualBtn',25,28,45,25,'rgb(110,20,15)'));
 put('docs/design/example/ref.html',html('refBtn',20,30,40,20,'rgb(100,10,20)'));
 put('docs/design/example/keyart/ui.review.json',JSON.stringify({mode:'ui',entry:'actual.html',viewport:{width:200,height:120},presets:[{id:'screen',frame:0}],ui:{reference:'ref.html',canvas:{width:200,height:120,selector:'#stage'},items:[{id:'go',selector:'#refBtn',actualSelector:'#actualBtn'}]}}));
 const ui=await keyartReview(root,'example','ui');const diff=ui.metrics.shots[0].ui[0];assert.deepEqual(diff.position,{dx:5,dy:-2});assert.deepEqual(diff.size,{dw:5,dh:5});assert.deepEqual(diff.bg.deltaRgb,[10,10,-5]);assert.equal(ui.metrics.advisoryOnly,true);console.log('BROWSER: UI same ruler reports exact dx=5 dy=-2 dw=5 dh=5 RGB=[10,10,-5]');
}finally{rmSync(root,{recursive:true,force:true});}
