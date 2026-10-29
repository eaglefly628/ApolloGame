/** The model must contain its animation: model readiness then includes clip parsing.
 * Call before exposing the Engine to play/pause controls, with graph speed zero.
 * No simulation loop starts while this read-only first frame is prepared.
 */
export async function primeEmbeddedPreview(options:{render:()=>void;modelCount:()=>number;nextFrame:()=>Promise<void>;cancelled:()=>boolean;maxFrames?:number}):Promise<boolean>{
 for(let i=0;i<(options.maxFrames??1800);i++){
  if(options.cancelled())return false;
  options.render();
  if(options.modelCount()>0)return true;
  await options.nextFrame();
 }
 if(options.cancelled())return false;
 throw new Error('角色与内嵌动作未能完成准备，请重新选择角色');
}
