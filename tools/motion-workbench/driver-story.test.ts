import {it,expect} from 'vitest';
import {validateDriverStory} from './driver-story.js';
const chapter=()=>({profileId:'a',title:'雪夜',narration:'她走到街角。',delivery:'animation' as const});
it('keeps story optional, clones the closed metadata and preserves video-planned as a plan',()=>{
 expect(validateDriverStory(undefined,['a'])).toBeUndefined();
 const input={title:'故事',chapters:[{...chapter(),delivery:'video-planned'}]};
 const result=validateDriverStory(input,['a'])!;input.chapters[0].title='changed';
 expect(result.chapters[0].title).toBe('雪夜');expect(result.chapters[0].delivery).toBe('video-planned');
});
it.each([
 {title:'故事',chapters:[]},
 {title:'故事',chapters:Array.from({length:17},chapter)},
 {title:'故事',chapters:[chapter(),chapter()]},
 {title:'故事',chapters:[{...chapter(),profileId:'missing'}]},
 {title:'故事',chapters:[{...chapter(),delivery:'generated-video'}]},
 {title:'故事',chapters:[{...chapter(),src:'https://example.test/video.mp4'}]},
 {title:'故事',chapters:[{...chapter(),narration:' '.repeat(10)}]},
 {title:'故事',chapters:[{...chapter(),narration:'x'.repeat(2049)}]},
 {title:'x'.repeat(129),chapters:[chapter()]},
 {title:'故事',chapters:[chapter()],autoLoop:true},
])('refuses invalid/unbound story metadata',input=>expect(()=>validateDriverStory(input,['a'])).toThrow());
it('rejects getters before executing source code',()=>{let reads=0;const input={title:'故事',get chapters(){reads++;return[chapter()];}};expect(()=>validateDriverStory(input,['a'])).toThrow();expect(reads).toBe(0);});
