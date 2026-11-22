// Integrate the existing independent weather producer without editing its source.
// Its raycast loader originally assumed an untextured v1 GLB. Strip only material
// bindings in an in-memory collision copy; retain all vertex/index/node data.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const sourceUrl=new URL('../weather/assemble.mjs',import.meta.url);
let source=readFileSync(sourceUrl,'utf8');
const anchor="const modelUrl = new URL('public/art/reference-rebuild-20261120/scene/street-reference.glb', root);";
if(!source.includes(anchor))throw Error('Weather producer changed; review integration anchor');
source=source.replace(anchor,"const currentConfig=JSON.parse(readFileSync(new URL('public/scenes/reference-street.json',root),'utf8'));\nconst modelUrl=new URL('public'+currentConfig.assets.find(a=>a.key==='reference-street').src,root);");
const parseAnchor="const model = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');";
if(!source.includes(parseAnchor))throw Error('Weather GLB parse anchor changed');
source=source.replace(parseAnchor,`const jsonLength=bytes.readUInt32LE(12),geometryJson=JSON.parse(bytes.subarray(20,20+jsonLength));
for(const mesh of geometryJson.meshes??[])for(const primitive of mesh.primitives)delete primitive.material;
delete geometryJson.materials;delete geometryJson.images;delete geometryJson.textures;
const jsonData=Buffer.from(JSON.stringify(geometryJson)),jsonPad=Buffer.alloc((4-jsonData.length%4)%4,32),jsonChunk=Buffer.concat([jsonData,jsonPad]),binChunk=bytes.subarray(20+jsonLength),header=Buffer.alloc(20);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+jsonChunk.length+binChunk.length,8);header.writeUInt32LE(jsonChunk.length,12);header.writeUInt32LE(0x4e4f534a,16);
const geometryBytes=Buffer.concat([header,jsonChunk,binChunk]);
const model=await new GLTFLoader().parseAsync(geometryBytes.buffer.slice(geometryBytes.byteOffset,geometryBytes.byteOffset+geometryBytes.byteLength),'');
const ground=currentConfig.manifest.entities['ground-continuation'];
if(ground){const m=ground.Mesh3D,t=ground.Transform3D,o=new THREE.Mesh(new THREE.BoxGeometry(m.width,m.height,m.depth),new THREE.MeshBasicMaterial());o.position.set(t.x,t.y,t.z);model.scene.add(o);}`);
const generated=new URL('./weather-integration.generated.mjs',import.meta.url);
writeFileSync(generated,source);execFileSync(process.execPath,[fileURLToPath(generated)],{stdio:'inherit'});
