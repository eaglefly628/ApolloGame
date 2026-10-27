/** Rest-mesh framing only; root motion can subsequently move outside this view. */
export type SkinBounds = [[number, number, number], [number, number, number]];
export function frameSkin(bounds: unknown, scale: number, aspect: number) {
  if(!Array.isArray(bounds)||bounds.length!==2||!bounds.every(p=>Array.isArray(p)&&p.length===3&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e6)))throw new Error('Invalid Skin bounds');
  const [min,max]=bounds as SkinBounds;
  if(min.some((n,i)=>n>max[i])||!Number.isFinite(scale)||scale<=0||!Number.isFinite(aspect)||aspect<=0)throw new Error('Invalid Skin framing inputs');
  const center=min.map((n,i)=>(n/2+max[i]/2)*scale);
  const radius=Math.hypot(...min.map((n,i)=>(max[i]-n)*scale/2));
  if(!Number.isFinite(radius)||radius<1e-6||radius>1e6||center.some(n=>!Number.isFinite(n)||Math.abs(n)>1e6))throw new Error('Invalid normalized Skin bounds');
  const fov=40,halfVertical=fov*Math.PI/360,halfHorizontal=Math.atan(Math.tan(halfVertical)*aspect);
  // A padded enclosing sphere fits for every orbit yaw/pitch, even on narrow cards.
  const distance=radius*1.15/Math.sin(Math.min(halfVertical,halfHorizontal));
  if(!Number.isFinite(distance)||distance>1e8)throw new Error('Invalid Skin framing distance');
  return {yaw:0.25,pitch:0.12,fov,distance,pivotX:center[0],pivotY:center[1],pivotZ:center[2],near:radius*0.01,far:distance+radius*4+1};
}
