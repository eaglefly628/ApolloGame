// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountUI, apolloOnyx } from '../../src/ui/components/index.js';
import { buildPreview, type PreviewState } from './layout.js';
const cleanup:(()=>void)[]=[];
afterEach(()=>{for(const close of cleanup.splice(0).reverse())close();});
function mountedPreview(clips?:PreviewState['clips']){
  const state:PreviewState={skins:[{id:'A',status:'draft'},{id:'B',status:'draft'}],clips:[{id:'180-turn-w-briefcase',status:'draft',descZh:'180 Turn W/ Briefcase',category:'locomotion',emotion:['neutral']},{id:'idle',status:'draft',descZh:'Idle',category:'idle',emotion:['neutral']}],query:'',category:'',emotion:'',page:0,paused:false,message:''};
  if(clips)state.clips=clips;
  const host=document.createElement('div');document.body.appendChild(host);let mounted:ReturnType<typeof mountUI>|undefined;const commits:string[]=[];
  const render=()=>{if(mounted){mounted.update(buildPreview(state));return;}mounted=mountUI(host,buildPreview(state),{query:value=>{commits.push(value||'');state.query=value||'';state.page=0;render();},'select-clip':value=>{state.selectedId=value;render();},pause:()=>{state.paused=!state.paused;render();},'skin-first':value=>{state.skinIds=[value||'',state.skinIds?.[1]||'B'];render();}},apolloOnyx);};
  render();cleanup.push(()=>{mounted?.();host.remove();});return {state,host,commits};
}
describe('motion preview real mount interaction',()=>{
  it('commits Input through native change and preserves the query when selecting a skin',()=>{
    const {state,host,commits}=mountedPreview();const input=host.querySelector<HTMLInputElement>('#query')!;
    expect(input.dataset.action).toBe('query');input.value='180 Turn W/ Briefcase';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    expect(commits).toEqual([]);expect(state.query).toBe('');expect(host.querySelector('#message')?.textContent).toContain('2 个匹配动作');
    input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(commits).toEqual(['180 Turn W/ Briefcase']);expect(state.query).toBe('180 Turn W/ Briefcase');expect(host.querySelector('#message')?.textContent).toContain('1 个匹配动作');
    const skin=host.querySelector<HTMLSelectElement>('#skin-first')!;skin.value='B';skin.dispatchEvent(new Event('change',{bubbles:true}));
    expect(state.skinIds?.[0]).toBe('B');expect(state.query).toBe('180 Turn W/ Briefcase');expect(host.querySelector<HTMLInputElement>('#query')?.value).toBe('180 Turn W/ Briefcase');expect(host.querySelector('#message')?.textContent).toContain('1 个匹配动作');
  });
  it('dispatches exact row ids and preserves mounted playback canvas during pause',()=>{const {host,state}=mountedPreview();const stage=host.querySelector('#stage-0-0')!;const canvas=document.createElement('canvas');stage.appendChild(canvas);host.querySelector<HTMLElement>('[data-vlist-row=idle]')!.click();expect(state.selectedId).toBe('idle');host.querySelector<HTMLButtonElement>('#pause')!.click();expect(state.paused).toBe(true);expect(host.querySelector('#stage-0-0 canvas')).toBe(canvas);expect(host.querySelector('#pause')?.textContent).toContain('继续播放');});
  it('keeps the scrolled directory node and position when selecting a distant exact id',()=>{
    const clips=Array.from({length:2445},(_,index)=>({id:`clip-${String(index).padStart(4,'0')}`,status:'draft',source:{mixamoName:'Same source name',description:'Standing idle'}}));
    const {host,state}=mountedPreview(clips);const list=host.querySelector<HTMLElement>('[data-vlist]')!;list.scrollTop=19000;list.dispatchEvent(new Event('scroll'));
    const row=host.querySelector<HTMLElement>('[data-vlist-row=clip-0500]')!;expect(row).not.toBeNull();row.click();
    expect(state.selectedId).toBe('clip-0500');expect(host.querySelector('#selected-id')?.textContent).toContain('clip-0500');
    expect(host.querySelector('[data-vlist]')).toBe(list);expect(list.scrollTop).toBe(19000);expect(host.querySelector('[data-vlist-row=clip-0500]')).toBe(row);
  });
  it('renders no-match and clearing after committed changes without a custom input handler',()=>{
    const {host,state}=mountedPreview();let input=host.querySelector<HTMLInputElement>('#query')!;input.value='no-such-motion';input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(host.querySelector('#message')?.textContent).toContain('0 个匹配动作');expect(host.querySelector('#empty')).not.toBeNull();
    input=host.querySelector<HTMLInputElement>('#query')!;input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(state.query).toBe('');expect(host.querySelector('#message')?.textContent).toContain('2 个匹配动作');expect(host.querySelector('#empty')).toBeNull();
  });
});
