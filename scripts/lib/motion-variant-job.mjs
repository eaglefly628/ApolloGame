import { check, motionId } from './motion-catalog.mjs';
export const VARIANT_KINDS = Object.freeze(['trim','mirror','loop-fix']);
export function validateVariantJob(job) {
  check(job && typeof job==='object'&&Object.getPrototypeOf(job)===Object.prototype,'variant job required');
  check(Object.keys(job).every(k=>['op','inputs','params','outputs'].includes(k))&&job.op==='motion-variant','unknown variant job field/op');
  check(Array.isArray(job.inputs)&&job.inputs.length===1&&Array.isArray(job.outputs)&&job.outputs.length===1,'variant requires one input and output');
  for(const path of [...job.inputs,...job.outputs])check(typeof path==='string'&&path.trim()&&!path.includes('\0')&&path.toLowerCase().endsWith('.glb'),'variant paths must be GLB');
  const p=job.params;check(p&&typeof p==='object'&&Object.getPrototypeOf(p)===Object.prototype&&Object.keys(p).every(k=>['profile','clipId','fps','kind','trim'].includes(k)),'unknown variant parameter');
  check(p.profile==='apollo-humanoid-v1','unknown variant profile');motionId(p.clipId);
  check(Number.isInteger(p.fps)&&p.fps>=1&&p.fps<=120,'variant fps must be 1..120');
  check(VARIANT_KINDS.includes(p.kind),'unknown variant kind');
  if(p.kind==='trim')check(Array.isArray(p.trim)&&p.trim.length===2&&p.trim.every(Number.isFinite)&&p.trim[0]>=0&&p.trim[1]>p.trim[0]&&p.trim.every(t=>Math.abs(t*p.fps-Math.round(t*p.fps))<1e-6),'trim needs increasing nonnegative seconds aligned to fps');
  else check(!Object.hasOwn(p,'trim'),'trim belongs only to trim variant');
  return job;
}
