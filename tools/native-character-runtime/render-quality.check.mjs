import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { nativeRasterMetrics, adaptNativeRaster, adaptNativeTexture } from './render-quality.mjs';

assert.deepEqual(nativeRasterMetrics(154,141,2,true), {width:308,height:282});
assert.deepEqual(nativeRasterMetrics(154,141,1,true), {width:154,height:141});
assert.deepEqual(nativeRasterMetrics(154,141,1.25,true), {width:193,height:176});
for (const density of [3,100]) assert.deepEqual(nativeRasterMetrics(154,141,density,true), {width:308,height:282});
for (const density of [undefined,NaN,Infinity,-1,0]) assert.deepEqual(nativeRasterMetrics(154,141,density,true), {width:154,height:141});
assert.deepEqual(nativeRasterMetrics(0,0,2,true), {width:1,height:1});
assert.deepEqual(nativeRasterMetrics(154,141,2,false), {width:154,height:141});

const original = readFileSync(new URL('./vendor/stretchystudio/src/renderer/scenePass.js',import.meta.url),'utf8');
const adapted = adaptNativeRaster(original);
assert.throws(()=>adaptNativeRaster(original.replace('canvas.width  = canvas.clientWidth;', 'canvas.width = 999;')), /anchor/);
assert.throws(()=>adaptNativeRaster(original+original), /anchor/);
// Execute the actual adapted upstream draw pass with GL calls replaced by spies.
// This checks the camera, viewport and skipResize path together, not just strings.
function draw(density, options) {
  const canvas = {width:154,height:141,clientWidth:154,clientHeight:141};
  let matrix, viewport;
  const gl = new Proxy({canvas,viewport:(...v)=>{viewport=v;}},{get:(obj,key)=>obj[key]??(()=>{})});
  const Scene = vm.runInNewContext(adapted.replace(/^import .*;$/gm,'').replace('export class ScenePass','class ScenePass')+'\nScenePass;', {
    globalThis:{devicePixelRatio:density},
    computeWorldMatrices:()=>new Map(),
    computeEffectiveProps:()=>({visMap:new Map([['p',true]]),opMap:new Map([['p',1]])}),
    matchTag:()=>null,
  });
  const scene = {gl,meshUniforms:()=>0,partRenderer:{drawPart:(_id,m)=>{matrix=Array.from(m);}},bgRenderer:{draw(){}}};
  Scene.prototype.draw.call(scene,{canvas:{width:1312,height:1199},nodes:[{id:'p',name:'body',type:'part',draw_order:0}]},
    {view:{zoom:.1173780487804878,panX:0,panY:.13185975609756},overlays:{},selection:[]},true,null,options);
  return {canvas,matrix,viewport};
}
const one=draw(1,{exportMode:true}),two=draw(2,{exportMode:true});
assert.deepEqual(two.viewport,[0,0,308,282]);
assert.deepEqual(two.matrix,one.matrix,'DPR must not change projected size or ground position');
assert.equal(two.canvas.clientWidth,154,'CSS dimensions stay unchanged');
assert.deepEqual(draw(2,{exportMode:false}).viewport,[0,0,154,141],'non-player unchanged');
assert.deepEqual(draw(2,{exportMode:true,skipResize:true}).viewport,[0,0,154,141],'explicit export buffer untouched');
const textureSource=readFileSync(new URL('./vendor/stretchystudio/src/renderer/partRenderer.js',import.meta.url),'utf8');
const textureAdapted=adaptNativeTexture(textureSource);
assert.throws(()=>adaptNativeTexture(textureSource+textureSource),/anchor/);
assert.throws(()=>adaptNativeTexture(textureSource.replace('gl.TEXTURE_MIN_FILTER, gl.LINEAR','gl.TEXTURE_MIN_FILTER, gl.NEAREST')),/anchor/);
const Part=vm.runInNewContext(textureAdapted.replace('export class PartRenderer','class PartRenderer')+'\nPartRenderer;');
const filters=[],uploads=[],mips=[];
const textureGl={TEXTURE_2D:3553,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,LINEAR:9729,LINEAR_MIPMAP_LINEAR:9987,
  createTexture:()=>({}),bindTexture(){},texParameteri:(...v)=>filters.push(v),pixelStorei(){},texImage2D:(...v)=>uploads.push(v),generateMipmap:(...v)=>mips.push(v)};
const originalImage={untouched:true};
new Part(textureGl,{},{}).uploadTexture('cat',originalImage);
assert.ok(filters.some(v=>v[1]===10241&&v[2]===9987),'trilinear mip sampling enabled');
assert.ok(filters.some(v=>v[1]===10240&&v[2]===9729),'magnification remains linear');
assert.equal(uploads[0].at(-1),originalImage,'no texture/source repaint');
assert.equal(mips.length,1,'upstream mip chain retained');
console.log('PASS: 2x native raster, density bounds, unchanged camera/CSS, export isolation, anchored adapter.');
