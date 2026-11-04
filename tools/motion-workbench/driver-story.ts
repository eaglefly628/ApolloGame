import {validateDriverTree, driverFields} from '../../src/engine/protocol/components/animation-driver.js';

export interface DriverStoryChapter {
 readonly profileId:string;
 readonly title:string;
 readonly narration:string;
 readonly delivery:'animation'|'video-planned';
}
export interface DriverStory {readonly title:string;readonly chapters:readonly DriverStoryChapter[]}

/** Metadata selects declared local profiles; it never introduces URLs or a second animation clock. */
export function validateDriverStory(raw:unknown,profileIds:readonly string[]):DriverStory|undefined {
 if(raw===undefined)return undefined;
 validateDriverTree(raw);
 const story=driverFields(raw,['title','chapters'],'driver story');
 const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
 if(!text(story.title,128)||!Array.isArray(story.chapters)||story.chapters.length<1||story.chapters.length>16)throw Error('driver story: title/chapter budget');
 const available=new Set(profileIds),seen=new Set<string>();
 for(const value of story.chapters){
  const c=driverFields(value,['profileId','title','narration','delivery'],'story chapter');
  if(typeof c.profileId!=='string'||!available.has(c.profileId)||seen.has(c.profileId))throw Error('driver story: missing/duplicate profile');
  seen.add(c.profileId);
  if(!text(c.title,128)||!text(c.narration,2048)||!['animation','video-planned'].includes(c.delivery as string))throw Error('driver story: chapter text/delivery');
 }
 return structuredClone(raw as DriverStory);
}
