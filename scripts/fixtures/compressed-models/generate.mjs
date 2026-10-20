// Offline fixture generation only. Encoder paths must point to the pinned official
// tools described in provenance.json; no download occurs here or during tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { BoxGeometry } from 'three';
import { encodePng } from '../../ai-gen.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const root = join(here, '../../..');
const meshoptPath = process.env.MESHOPT_ENCODER;
const basisPath = process.env.BASIS_ENCODER;
if (!meshoptPath || !basisPath) throw new Error('Set MESHOPT_ENCODER and BASIS_ENCODER to the pinned offline encoder files');
const { MeshoptEncoder } = await import(pathToFileURL(meshoptPath)); await MeshoptEncoder.ready;
const BASIS = require(basisPath);
const basis = await BASIS({ wasmBinary: readFileSync(join(dirname(basisPath), 'basis_encoder.wasm')) }); basis.initializeBasis();
const dracoPath = join(root, 'node_modules/three/examples/jsm/libs/draco/gltf/draco_encoder.js');
const box = { module: { exports: {} }, exports: {}, require, console, process, Buffer, WebAssembly, TextDecoder, TextEncoder, setTimeout, clearTimeout, __filename: dracoPath, __dirname: dirname(dracoPath) };
vm.runInNewContext(readFileSync(dracoPath, 'utf8'), box);
const draco = box.module.exports();
const geometry = new BoxGeometry(2, 2, 2);
const positions = geometry.attributes.position.array, normals = geometry.attributes.normal.array, uv = geometry.attributes.uv.array, indices = geometry.index.array;
const pngPixels = Buffer.alloc(16 * 16 * 3);
for (let y=0;y<16;y++) for(let x=0;x<16;x++) {
  const color = y < 8 ? (x < 8 ? [255,0,0] : [0,255,0]) : (x < 8 ? [0,0,255] : [255,255,0]);
  color.forEach((v,k)=>pngPixels[(y*16+x)*3+k]=v);
}
const png = encodePng(16,16,pngPixels);
const be = new basis.BasisEncoder(); const out = new Uint8Array(65536);
be.setCreateKTX2File(true); be.setKTX2UASTCSupercompression(true); be.setKTX2SRGBTransferFunc(true);
be.setSliceSourceImage(0, png, 0, 0, true); be.setUASTC(true); be.setPerceptual(true); be.setMipGen(false);
const size = be.encode(out); be.delete(); if (!size) throw new Error('Basis encode failed'); const ktx = Buffer.from(out.slice(0,size));
function glb(doc, binary) {
  const raw=Buffer.from(JSON.stringify(doc)), json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]), bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
  const b=Buffer.alloc(28+json.length+bin.length); b.write('glTF');b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(json.length,12);b.writeUInt32LE(0x4e4f534a,16);json.copy(b,20);b.writeUInt32LE(bin.length,20+json.length);b.writeUInt32LE(0x004e4942,24+json.length);bin.copy(b,28+json.length);return b;
}
function make(kind) {
  const blobs=[], views=[]; let offset=0;
  function chunk(data) { const bytes=Buffer.from(data.buffer||data,data.byteOffset||0,data.byteLength);const pad=Buffer.alloc((4-offset%4)%4);blobs.push(pad);offset+=pad.length;const id=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length});blobs.push(bytes);offset+=bytes.length;return id; }
  const attrs={POSITION:0,NORMAL:1,TEXCOORD_0:2};
  const accessors=[{componentType:5126,count:24,type:'VEC3',min:[-1,-1,-1],max:[1,1,1]},{componentType:5126,count:24,type:'VEC3'},{componentType:5126,count:24,type:'VEC2'},{componentType:5123,count:36,type:'SCALAR'}];
  const primitive={attributes:attrs,indices:3,material:0};
  const extensionsUsed=['KHR_materials_unlit'], extensionsRequired=[];
  if (kind==='draco') {
    const mesh=new draco.Mesh(), builder=new draco.MeshBuilder(), encoder=new draco.Encoder(), data=new draco.DracoInt8Array();
    const p=builder.AddFloatAttributeToMesh(mesh,draco.POSITION,24,3,positions), n=builder.AddFloatAttributeToMesh(mesh,draco.NORMAL,24,3,normals), t=builder.AddFloatAttributeToMesh(mesh,draco.TEX_COORD,24,2,uv);
    builder.AddFacesToMesh(mesh,12,indices);encoder.SetAttributeQuantization(draco.POSITION,14);encoder.SetAttributeQuantization(draco.NORMAL,12);encoder.SetAttributeQuantization(draco.TEX_COORD,14);
    const len=encoder.EncodeMeshToDracoBuffer(mesh,data);if(len<=0)throw new Error('Draco encode failed');const bytes=Buffer.alloc(len);for(let i=0;i<len;i++)bytes[i]=data.GetValue(i);
    primitive.extensions={KHR_draco_mesh_compression:{bufferView:chunk(bytes),attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:t}}};extensionsUsed.push('KHR_draco_mesh_compression');extensionsRequired.push('KHR_draco_mesh_compression');
    [data,encoder,builder,mesh].forEach(x=>draco.destroy(x));
  } else {
    for (const [i,arr] of [positions,normals,uv,indices].entries()) {
      if (kind==='meshopt') {
        const count=i===3?36:24, stride=i===3?2:i===2?8:12, mode=i===3?'TRIANGLES':'ATTRIBUTES';
        const encoded=MeshoptEncoder.encodeGltfBuffer(new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength),count,stride,mode);
        const index=chunk(encoded), source=views[index];
        // Required extension has no uncompressed fallback: removing the decoder must fail.
        views[index]={buffer:1,byteOffset:0,byteLength:arr.byteLength,...(i===3?{}:{byteStride:stride}),extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:source.byteOffset,byteLength:source.byteLength,byteStride:stride,count,mode,filter:'NONE'}}};
        accessors[i].bufferView=index;
      } else accessors[i].bufferView=chunk(arr);
    }
    if(kind==='meshopt'){extensionsUsed.push('EXT_meshopt_compression');extensionsRequired.push('EXT_meshopt_compression');}
  }
  const image=chunk(kind.startsWith('ktx2')?ktx:png);
  const doc={asset:{version:'2.0',generator:'Apollo authored E1 cube fixture'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'E1_authored_cube',mesh:0}],meshes:[{primitives:[primitive]}],accessors,bufferViews:views,images:[{bufferView:image,mimeType:kind.startsWith('ktx2')?'image/ktx2':'image/png'}],samplers:[{magFilter:9728,minFilter:9728,wrapS:33071,wrapT:33071}],textures:[kind.startsWith('ktx2')?{sampler:0,extensions:{KHR_texture_basisu:{source:0}}}:{sampler:0,source:0}],materials:[{extensions:{KHR_materials_unlit:{}},pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1}}],extensionsUsed,extensionsRequired,buffers:[{byteLength:offset}]};
  if(kind.startsWith('ktx2')){extensionsUsed.push('KHR_texture_basisu');extensionsRequired.push('KHR_texture_basisu');}
  if(kind==='ktx2-shared'){doc.samplers.push({...doc.samplers[0],magFilter:9729});doc.textures.push({...doc.textures[0],sampler:1});doc.materials.push({...doc.materials[0],pbrMetallicRoughness:{...doc.materials[0].pbrMetallicRoughness,baseColorTexture:{index:1}}});doc.meshes[0].primitives.push({...primitive,material:1});}
  if(kind==='meshopt')doc.buffers.push({byteLength:288,extensions:{EXT_meshopt_compression:{fallback:true}}});
  return glb(doc,Buffer.concat(blobs));
}
const files={};
for(const kind of ['raw','draco','meshopt','ktx2','ktx2-shared']) {const name=`cube-${kind}.glb`,bytes=make(kind);writeFileSync(join(here,name),bytes);files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
const hashes={};for(const file of [meshoptPath,basisPath,join(dirname(basisPath),'basis_encoder.wasm'),dracoPath])hashes[file.split('/').pop()]=createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(join(here,'provenance.json'),JSON.stringify({authorship:'Original procedural cube and 16x16 four-color PNG authored for Apollo E1; no external model or texture.',license:'CC0-1.0 (fixture geometry and texture)',geometry:{vertices:24,triangles:12,bounds:[[-1,-1,-1],[1,1,1]]},encoders:[{name:'Draco glTF encoder bundled with three 0.184.0',source:'https://github.com/mrdoob/three.js/tree/r184/examples/jsm/libs/draco',license:'Apache-2.0'},{name:'meshoptimizer v0.25',source:'https://github.com/zeux/meshoptimizer/blob/v0.25/js/meshopt_encoder.module.js',license:'MIT'},{name:'Basis Universal 1.16.4 WASM encoder',source:'https://github.com/BinomialLLC/basis_universal/tree/1.16.4/webgl/encoder/build',license:'Apache-2.0'}],encoderSha256:hashes,files},null,2)+'\n');
console.log(files);
