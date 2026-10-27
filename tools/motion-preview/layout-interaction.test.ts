// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountUI, apolloOnyx } from '../../src/ui/components/index.js';
import { buildPreview, type PreviewState } from './layout.js';
const cleanup:(()=>void)[]=[];
afterEach(()=>{for(const close of cleanup.splice(0).reverse())close();});
function mountedPreview(){
  const state:PreviewState={skins:[{id:'A',status:'draft'},{id:'B',status:'draft'}],clips:[{id:'180-turn-w-briefcase',status:'draft',descZh:'180 Turn W/ Briefcase',category:'locomotion',emotion:['neutral']},{id:'idle',status:'draft',descZh:'Idle',category:'idle',emotion:['neutral']}],query:'',category:'',emotion:'',page:0,paused:false,message:''};
  const host=document.createElement('div');document.body.appendChild(host);let mounted:ReturnType<typeof mountUI>|undefined;const commits:string[]=[];
  const render=()=>{mounted?.();mounted=mountUI(host,buildPreview(state),{query:value=>{commits.push(value||'');state.query=value||'';state.page=0;render();},'skin-first':value=>{state.skinIds=[value||'',state.skinIds?.[1]||'B'];render();}},apolloOnyx);};
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
  it('renders no-match and clearing after committed changes without a custom input handler',()=>{
    const {host,state}=mountedPreview();let input=host.querySelector<HTMLInputElement>('#query')!;input.value='no-such-motion';input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(host.querySelector('#message')?.textContent).toContain('0 个匹配动作');expect(host.querySelector('#empty')).not.toBeNull();
    input=host.querySelector<HTMLInputElement>('#query')!;input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(state.query).toBe('');expect(host.querySelector('#message')?.textContent).toContain('2 个匹配动作');expect(host.querySelector('#empty')).toBeNull();
  });
});
