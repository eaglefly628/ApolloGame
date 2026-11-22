import type {LayoutNode} from '@ui/components/index.js';
// Keep the lower scene fully opaque throughout the foreground blend.
export function sceneLayers(active:number,incoming?:number){
  return [0,1].map(slot=>({opacity:slot===active||slot===incoming?1:0,
    ...(incoming===1&&slot===1?{anim:'fadeIn' as const}:incoming===0&&slot===1?{anim:'fadeOut' as const}:{})}));
}
export function sceneLayout(layout:LayoutNode):LayoutNode{
  const tree=structuredClone(layout);
  if(tree.layout){delete tree.layout.anim;delete tree.layout.animMs;}
  const stage=tree.children!.find(n=>n.id==='scene-stage')!;
  stage.layout={flex:1,direction:'overlay'};
  stage.children=[0,1].map(slot=>({id:`scene-surface-${slot}`,type:'Panel',props:{bare:true},
    layout:{parentAnchor:{anchorMin:{x:0,y:0},anchorMax:{x:1,y:1}},allowOverlap:true}}));
  return tree;
}

/** Render-surface composition only. Changing LayoutNode props would recreate its WebGL canvas. */
export class SceneCompositor{
  private animation?:Animation;
  constructor(private readonly surfaces:HTMLElement[],active:number){this.show(active);}
  show(active:number){
    this.surfaces.forEach((surface,slot)=>{surface.style.opacity=slot===active?'1':'0';surface.style.pointerEvents=slot===active?'auto':'none';});
    this.animation?.cancel();this.animation=undefined;
  }
  async blend(active:number,incoming:number,duration:number){
    const layers=sceneLayers(active,incoming);
    // The bottom framebuffer is always opaque; animate only the top framebuffer.
    this.surfaces[0].style.opacity=String(layers[0].opacity);
    this.surfaces[1].style.opacity=incoming===1?'0':'1';
    this.animation=this.surfaces[1].animate([{opacity:incoming===1?0:1},{opacity:incoming===1?1:0}],{duration,easing:'ease-in-out',fill:'forwards'});
    await this.animation.finished;
    this.show(incoming);
  }
}
