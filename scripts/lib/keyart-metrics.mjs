// Objective measurements are navigation aids, never acceptance thresholds.
import { decodePng, encodePngRGBA } from '../asset-matte.mjs';
const round=n=>+n.toFixed(6);
function stats(image) {
  const hist=Array(36).fill(0), rgb=Array(48).fill(0), regions=Array(9).fill(0), counts=Array(9).fill(0);
  for(let y=0;y<image.h;y++)for(let x=0;x<image.w;x++){
    const o=(y*image.w+x)*4,a=image.rgba[o+3]/255;
    const [r,g,b]=[0,1,2].map(k=>(image.rgba[o+k]*a+255*(1-a))/255);
    const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let hue=d===0?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;
    hist[Math.min(35,Math.floor(hue*6))]++;
    [r,g,b].forEach((c,k)=>rgb[k*16+Math.min(15,Math.floor(c*16))]++);
    const region=Math.min(2,Math.floor(y*3/image.h))*3+Math.min(2,Math.floor(x*3/image.w));
    regions[region]+=0.2126*r+0.7152*g+0.0722*b;counts[region]++;
  }
  const total=image.w*image.h;
  return {hue:hist.map(n=>n/total),rgb:rgb.map(n=>n/(total*3)),brightness:regions.map((n,i)=>counts[i]?n/counts[i]:0)};
}
export function imageMetrics(reference, actual) {
  const a=stats(decodePng(reference)),b=stats(decodePng(actual));
  const distance=(x,y)=>round(x.reduce((n,v,i)=>n+Math.abs(v-y[i]),0)/2);
  return {advisoryOnly:true,hueHistogramDistance:distance(a.hue,b.hue),rgbHistogramDistance:distance(a.rgb,b.rgb),regions:a.brightness.map((v,i)=>({row:Math.floor(i/3),column:i%3,reference:round(v),actual:round(b.brightness[i]),delta:round(b.brightness[i]-v)}))};
}
export function sideBySide(reference,actual) {
  const images=[decodePng(reference),decodePng(actual)];
  const h=Math.min(720,Math.max(...images.map(i=>i.h)));
  const widths=images.map(i=>Math.max(1,Math.round(i.w*h/i.h))),w=widths[0]+widths[1];
  if(w>8192)throw new Error('对比图过宽');
  const rgba=Buffer.alloc(w*h*4,255);let offset=0;
  for(const [index,img] of images.entries()){
    for(let y=0;y<h;y++)for(let x=0;x<widths[index];x++){
      const src=(Math.min(img.h-1,Math.floor(y*img.h/h))*img.w+Math.min(img.w-1,Math.floor(x*img.w/widths[index])))*4;
      img.rgba.copy(rgba,(y*w+offset+x)*4,src,src+4);
    }
    offset+=widths[index];
  }
  return encodePngRGBA(w,h,rgba);
}
function rgb(value){const m=typeof value==='string'&&value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);if(m)return m.slice(1).map(Number);const h=typeof value==='string'&&value.match(/^#([0-9a-f]{6})$/i);return h?[0,2,4].map(i=>parseInt(h[1].slice(i,i+2),16)):null;}
export function uiDifferences(reference,actual) {
  const map=rows=>{const out=new Map();for(const r of rows){if(!r.id||out.has(r.id))throw new Error('UI 量稿需要唯一 id');out.set(r.id,r);}return out;};
  const refs=map(reference),shots=map(actual);
  return [...new Set([...refs.keys(),...shots.keys()])].sort().map(id=>{
    const a=refs.get(id),b=shots.get(id);if(!a||!b)return{id,missing:!a?'reference':'actual'};
    const colors={};for(const field of ['bg','color']){const x=rgb(a[field]),y=rgb(b[field]);colors[field]={reference:a[field],actual:b[field],deltaRgb:x&&y?x.map((v,i)=>round(y[i]-v)):null};if(!x||!y)console.info(`[keyart-review] skip: ${id}.${field} 无纯色可比，保留原始值`);}
    return{id,position:{dx:round(b.x-a.x),dy:round(b.y-a.y)},size:{dw:round(b.w-a.w),dh:round(b.h-a.h)},...colors};
  });
}
