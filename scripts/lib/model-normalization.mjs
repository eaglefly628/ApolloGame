// Cross-check the two T4 artifacts before either is published by the job bridge.
function reject(message) { console.error(`[model-normalize] reject: ${message}`); throw new Error(`model-normalize: ${message}`); }
const finite = n => typeof n === 'number' && Number.isFinite(n);
const positive = n => finite(n) && n > 0;
const integer = n => Number.isSafeInteger(n) && n > 0;
function bounds(value,label) {
  if(!Array.isArray(value)||value.length!==2||value.some(v=>!Array.isArray(v)||v.length!==3||!v.every(finite))||value[0].some((v,i)=>v>value[1][i]))reject(`${label} 必须是有限的[min,max]三维边界`);
}
export function validateNormalizationResult(data,glb,params,{mock=false}={}) {
  if(mock) {
    if(data?.mock!==true||data.spec!==null||data.normalization!==null)reject('mock不能伪造规范化实测spec');
    return data;
  }
  const s=data?.spec,n=data?.normalization;
  if(!s||!n||data.mock)reject('真实normalize缺少spec/normalization');
  if(s.scale!==1||s.up!=='Y'||s.pivot!=='bottom-center')reject('spec必须是已烘焙scale=1、Y-up、bottom-center轴心');
  if(!integer(s.tris)||s.tris>params.maxTris)reject('spec.tris超过面数预算或不是正整数');
  if(s.bytes!==glb.length)reject('spec.bytes与实际GLB字节不符');
  if(n.sourceUp!==params.sourceUp||n.targetHeightMeters!==params.targetHeightMeters||n.maxTextureSize!==params.maxTextureSize)reject('规范化参数与本次job不符');
  if(!positive(n.appliedScale)||n.trianglesIn!==s.tris||n.trianglesOut!==s.tris)reject('缩放/面数实测记录无效（不得暗中减面）');
  if(n.compression!=='draco')reject('规范化必须实际Draco压缩');
  bounds(n.sourceBounds,'sourceBounds');bounds(n.bounds,'bounds');
  const [min,max]=n.bounds,tolerance=Math.max(1e-7,params.targetHeightMeters*0.0005);
  if(Math.abs(min[1])>tolerance||Math.abs(min[0]+max[0])>tolerance||Math.abs(min[2]+max[2])>tolerance||Math.abs(max[1]-min[1]-params.targetHeightMeters)>tolerance)reject('输出轴向/米制高度/脚底中心与规格不符');
  if(!Array.isArray(n.textureSizes)||n.textureSizes.some(t=>!t||typeof t.name!=='string'||!integer(t.width)||!integer(t.height)||Math.max(t.width,t.height)>params.maxTextureSize))reject('贴图尺寸记录无效或超过2k预算');
  let doc;try {doc=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));}catch {reject('规范化GLB缺有效JSON');}
  if(!doc.extensionsUsed?.includes('KHR_draco_mesh_compression'))reject('GLB没有实际Draco扩展，不能以metadata冒成功');
  let tris=0;
  for(const mesh of doc.meshes??[])for(const primitive of mesh.primitives??[]) {
    if((primitive.mode??4)!==4||!primitive.extensions?.KHR_draco_mesh_compression||!Number.isInteger(primitive.attributes?.POSITION))reject('每个triangle primitive都必须实际Draco压缩');
    const count=doc.accessors?.[primitive.indices]?.count;
    if(!integer(count)||count%3)reject('Draco primitive缺少有效三角索引计数');
    tris+=count/3;
  }
  if(tris!==s.tris)reject('spec.tris与GLB实际索引计数不符');
  return data;
}
