import {readFile,writeFile} from 'node:fs/promises';
import {Quaternion,Euler} from 'three';
const folder = new URL('site/art/reference-rebuild-20261120/scene/',import.meta.url);
const style={seconds:10.8, phase:.5, look:.21, tail:.56, pitch:.09, breath:.11};
const input=await readFile(new URL("./evidence/cat-floor-turn-source.glb",import.meta.url));
const size=input.readUInt32LE(12);
const data=JSON.parse(input.subarray(20,20+size));
let bytes=input.subarray(28+size);
const id=suffix=>data.nodes.findIndex(n=>n.name.endsWith('_'+suffix));
const clip=data.animations.find(a=>a.name==='cat_paws_ik');
clip.name='cat_cafe_route';
const count=Math.round(style.seconds*60);
const times=Array.from({length:count+1},(_,i)=>i/60);
function samples(values,type,width) {
  const typed=new Float32Array(values.flat());
  const offset=bytes.length;
  bytes=Buffer.concat([bytes,Buffer.from(typed.buffer)]);
  const view=data.bufferViews.push({buffer:0,byteOffset:offset,byteLength:typed.byteLength})-1;
  const axes=Array.from({length:width},(_,a)=>typed.filter((_,i)=>i%width===a));
  return data.accessors.push({bufferView:view,componentType:5126,count:typed.length/width,type,
    min:axes.map(list=>Math.min(...list)),max:axes.map(list=>Math.max(...list))})-1;
}
const inputTrack=samples(times,'SCALAR',1);
function track(node,path,curve) {
  const values=times.map((_,i)=>curve((i%count)/count));
  const width=values[0].length;
  const output=samples(values,width===4?'VEC4':'VEC3',width);
  clip.channels.push({sampler:clip.samplers.push({input:inputTrack,output,interpolation:'LINEAR'})-1,target:{node,path}});
}
const wave=t=>t*2*Math.PI;
const ease=x=>{const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t);};
const smoothSway=(t,phase)=>Math.sin(wave(t)+phase);
const breath=t=>style.breath*(.5-.5*Math.cos(wave(t)*2+style.phase));
const q=(x,y,z)=>new Quaternion().setFromEuler(new Euler(x,y,z,'YXZ')).toArray();
track(id('BodyBreath'),'scale',t=>[1+.055*breath(t)/style.breath,1+breath(t),1+.07*breath(t)/style.breath]);
const head=id('HeadLook');
const anchor=data.nodes[head].translation;
track(head,'translation',t=>[anchor[0],anchor[1]+breath(t)*.18,anchor[2]]);
track(head,'rotation',t=>q(style.pitch*smoothSway(t*2,style.phase),style.look*smoothSway(t,style.phase),
    .10*smoothSway(t,style.phase-.8)));
track(id('TailSway'),'rotation',t=>q(0,.24+style.tail*smoothSway(t*2,style.phase),-.16+.30*smoothSway(t*2,style.phase+.7)));
for(let eye=0;eye<2;eye++){
  const blink=id('Blink_'+eye);
  if(blink<0) throw new Error('Missing eyes');
  const child=data.nodes[data.nodes[blink].children[0]];
  child.scale=[1.8,2.5,1.35];
  const material=data.meshes[child.mesh].primitives[0].material;
  data.materials[material].pbrMetallicRoughness.baseColorFactor=[.033,.023,.017,1];
  track(blink,'scale',t=>{
    const seconds=t*style.seconds;
    const cues=[.44,3.21,5.41,8.26,10.55];
    const nearest=Math.min(...cues.map(c=>Math.abs(seconds-c)));
    return [1,.12+.88*ease((nearest-.11)/.095),1];
  });
}
data.animations=[clip];
data.buffers[0].byteLength=bytes.length;
let json=JSON.stringify(data);
while(Buffer.byteLength(json)%4)json+=' ';
const jb=Buffer.from(json);
const header=Buffer.alloc(28);
[0x46546c67,2,28+jb.length+bytes.length,jb.length,0x4e4f534a,bytes.length,0x004e4942].forEach((x,i)=>header.writeUInt32LE(x,i*4));
await writeFile(new URL('cat-floor-cafe-visible.glb',folder),Buffer.concat([header.subarray(0,20),jb,header.subarray(20),bytes]));
