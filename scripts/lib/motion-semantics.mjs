/** Description-derived proposals. Never changes catalog approval or infers physical contact. */
export const DICTIONARY_VERSION = 'source-description-v1';
export const BROWSE_GROUPS = Object.freeze([
  ['locomotion','移动与转向'],['combat','战斗动作'],['dance','舞蹈'],['gesture','交谈与手势'],
  ['interaction','伸手与物体交互'],['daily','日常与运动'],['reaction','受击与反应'],['idle','待机'],['pose','静态姿势'],['posture','起坐与身体姿态'],['other','待分类'],
].map(([id,label])=>Object.freeze({id,label})));
const FACETS=['action','activity','role','posture','bodyPart','direction','propMention','emotion','style','poseContext','contact','startPosture','endPosture','phases'];
// Closed values; every proposal retains the exact matched source span.
const RECIPIENT=/\b(?:being|getting|got)\s+(?:\w+\s+){0,3}(?:hit|shot|punched|kicked|stabbed|slashed|attacked|thrown)\b|\breceiv(?:e|es|ed|ing)\s+(?:\w+\s+){0,6}(?:hit|punch|kick|shot|attack)\b/i;
const RULES=[
 ['role','recipient','受方','reaction',RECIPIENT],
 ['action','walk','行走','locomotion',/\bwalk(?:s|ed|ing)?\b/i],
 ['action','run','跑步','locomotion',/\b(?:run|runs|running|ran)\b/i],
 ['action','jog','慢跑','locomotion',/\bjog(?:s|ged|ging)?\b/i],
 ['action','sprint','冲刺','locomotion',/\bsprint(?:s|ed|ing)?\b/i],
 ['action','strafe','侧移','locomotion',/\bstraf(?:e|es|ed|ing)\b/i],
 ['action','turn','转向','locomotion',/\bturn(?:s|ed|ing)?\b/i],
 ['action','jump','跳跃','locomotion',/\b(?:jump(?:s|ed|ing)?|leap(?:s|ed|ing)?)\b/i],
 ['action','climb','攀爬','locomotion',/\bclimb(?:s|ed|ing)?\b/i],
 ['action','crawl','爬行','locomotion',/\bcrawl(?:s|ed|ing)?\b/i],
 ['action','swim','游泳','locomotion',/\b(?:swim|swims|swimming)\b/i],
 ['action','dance','舞蹈','dance',/\b(?:danc(?:e|es|ed|ing)|breakdanc(?:e|es|ed|ing)|hip[ -]?hop|charleston|samba|ballet)\b/i],
 ['action','punch','拳击','combat',/\b(?:punch(?:es|ed|ing)?|jab(?:s|bed|bing)?|uppercut)\b/i],
 ['action','kick','踢击','combat',/\bkick(?:s|ed|ing)?\b/i],
 ['action','attack','攻击','combat',/\battack(?:s|ed|ing)?\b/i],
 ['action','slash','挥砍','combat',/\b(?:slash(?:es|ed|ing)?|stab(?:s|bed|bing)?)\b/i],
 ['action','shoot','射击','combat',/\b(?:shoot(?:s|ing)?|shot|firing|fire(?=\s+(?:a\s+)?(?:rifle|pistol|gun)))\b/i],
 ['action','block','格挡','combat',/\bblock(?:s|ed|ing)?\b/i],
 ['action','dodge','闪避','combat',/\b(?:dodg(?:e|es|ed|ing)|evad(?:e|es|ed|ing))\b/i],
 ['action','talk','交谈','gesture',/\b(?:talk(?:s|ed|ing)?|chat(?:s|ted|ting)?)\b/i],
 ['action','wave','挥手','gesture',/\bwav(?:e|es|ed|ing)\b/i],
 ['action','point','指向','gesture',/\bpoint(?:s|ed|ing)?\b/i],
 ['action','clap','鼓掌','gesture',/\bclap(?:s|ped|ping)?\b/i],
 ['action','salute','敬礼','gesture',/\bsalut(?:e|es|ed|ing)\b/i],
 ['action','taunt','挑衅','gesture',/\btaunt(?:s|ed|ing)?\b/i],
 ['action','reach','伸手','interaction',/\breach(?:es|ed|ing)?\b/i],
 ['action','pick-up','拾取','interaction',/\bpick(?:s|ed|ing)?\s+(?:\w+\s+){0,2}up\b/i],
 ['action','hold','持握/保持','interaction',/\bhold(?:s|ing)?\b/i],
 ['action','carry','搬运','interaction',/\b(?:carry|carries|carried|carrying)\b/i],
 ['action','push','推动','interaction',/\bpush(?:es|ed|ing)?\b(?![ -]*ups?\b)/i],
 ['action','pull','拉动','interaction',/\bpull(?:s|ed|ing)?\b/i],
 ['action','throw','投掷','interaction',/\bthrow(?:s|ing)?\b/i],
 ['action','open','打开','interaction',/\bopen(?:s|ed|ing)?\b/i],
 ['action','close','关闭','interaction',/\bclos(?:e|es|ed|ing)\b/i],
 ['action','eat','进食','daily',/\beat(?:s|ing)?\b/i],
 ['action','drink','饮用','daily',/\bdrink(?:s|ing)?\b/i],
 ['action','sleep','睡眠','daily',/\bsleep(?:s|ing)?\b/i],
 ['action','drive','驾驶','daily',/\bdriv(?:e|es|ing)\b/i],
 ['action','text','发短信','daily',/\btext(?:s|ed|ing)\b/i],
 ['action','read','阅读','daily',/\bread(?:s|ing)?\b/i],
 ['action','pray','祈祷','daily',/\b(?:pray(?:s|ed|ing)?|prayer)\b/i],
 ['action','exercise','锻炼','daily',/\b(?:plank|push[ -]?up|sit[ -]?up|exercise|workout)\b/i],
 ['action','laugh','大笑','gesture',/\blaugh(?:s|ed|ing)?\b/i],
 ['action','cry','哭泣','gesture',/\b(?:cry|cries|cried|crying)\b/i],
 ['action','hit-reaction','受击','reaction',/\b(?:(?:receiv(?:e|es|ed|ing)|getting|got)\s+(?:a\s+)?(?:\w+\s+){0,2}hit|hit\s+reaction|impact|flinch(?:es|ed|ing)?)\b/i],
 ['action','fall','跌落','reaction',/\b(?:fall(?:s|ing)?|fell|stumble|tripping)\b/i],
 ['action','death','倒下/死亡','reaction',/\b(?:death|dying|die|dies|dead)\b/i],
 ['action','step','迈步','locomotion',/\bstep(?:s|ped|ping)?\b/i],
 ['action','roll','翻滚','locomotion',/\broll(?:s|ed|ing)?\b/i],
 ['action','acrobatics','翻腾特技','daily',/\b(?:backflip|frontflip|cartwheel)\b/i],
 ['action','aim','瞄准','combat',/\baim(?:s|ed|ing)?\b/i],
 ['action','cast-spell','施法','combat',/\bcast(?:s|ing)?\b(?=.{0,50}\b(?:spell|magic)\b)|\bspell\s+cast(?:ing)?\b/i],
 ['action','equip','装备/收放','interaction',/\b(?:equip(?:s|ped|ping)?|sheath(?:e|es|ed|ing)?|holster(?:s|ed|ing)?)\b/i],
 ['action','gesture','手势','gesture',/\b(?:gestur(?:e|es|ed|ing)|signal(?:s|ed|ing)?)\b/i],
 ['action','acknowledge','回应/同意','gesture',/\b(?:acknowledg(?:e|es|ed|ing)|agree(?:s|d|ing)?)\b/i],
 ['action','shake-head','摇头','gesture',/\bshak(?:e|es|ing)\s+(?:the\s+)?head\b/i],
 ['action','look','观察','idle',/\blook(?:s|ed|ing)?\b/i],
 ...[['golf','高尔夫'],['soccer','足球'],['football','橄榄球/足球'],['basketball','篮球'],['baseball','棒球']].map(([id,label])=>['activity',id,label,'daily',new RegExp('\\b'+id+'\\b','i')]),
 ['activity','boxing','拳击运动','combat',/\bboxing\b/i],
 ['action','idle','待机' ,'idle',/\b(?:idle|idling|stance|breathing)\b/i],
 ['posture','standing','站立',null,/\bstand(?:s|ing)?\b/i],
 ['posture','seated','坐姿',null,/\b(?:sit|sits|sitting|seated)\b/i],
 ['posture','crouched','蹲姿',null,/\bcrouch(?:ed|ing)?\b/i],
 ['posture','kneeling','跪姿',null,/\bkneel(?:s|ed|ing)?\b/i],
 ['posture','prone','俯卧',null,/\b(?:prone|on\s+(?:the\s+)?stomach)\b/i],
 ['posture','lying','躺卧',null,/\b(?:lying|laying|on\s+(?:the\s+)?back)\b/i],
 ['bodyPart','left-hand','左手',null,/\bleft\s+hand\b/i],
 ['bodyPart','right-hand','右手',null,/\bright\s+hand\b/i],
 ['bodyPart','both-hands','双手',null,/\b(?:both|two)\s+hands?\b/i],
 ['bodyPart','left-arm','左臂',null,/\bleft\s+arm\b/i],
 ['bodyPart','right-arm','右臂',null,/\bright\s+arm\b/i],
 ['bodyPart','left-leg','左腿',null,/\bleft\s+leg\b/i],
 ['bodyPart','right-leg','右腿',null,/\bright\s+leg\b/i],
 ['direction','forward','向前',null,/\b(?:walk(?:ing)?|run(?:ning)?|jog(?:ging)?|mov(?:e|ing)|push(?:ing)?|pull(?:ing)?|reach(?:ing)?)\s+(?:an?\s+\w+\s+)?forward(?:s)?\b/i],
 ['direction','backward','向后',null,/\b(?:walk(?:ing)?|run(?:ning)?|jog(?:ging)?|mov(?:e|ing)|crawl(?:ing)?)\s+backward(?:s)?\b/i],
 ['direction','left','向左',null,/\b(?:turn(?:ing)?|straf(?:e|ing)|walk(?:ing)?|arc)\s+(?:to\s+)?(?:the\s+)?left\b/i],
 ['direction','right','向右',null,/\b(?:turn(?:ing)?|straf(?:e|ing)|walk(?:ing)?|arc)\s+(?:to\s+)?(?:the\s+)?right\b/i],
 ...[['phone','电话'],['rifle','步枪'],['pistol','手枪'],['sword','剑'],['axe','斧'],['bow','弓'],['torch','火把'],['briefcase','公文包'],['table','桌子'],['chair','椅子'],['object','物体']].map(([id,label])=>['propMention',id,label,null,new RegExp('\\b'+id+'\\b','i')]),
 ...[['happy','高兴'],['sad','悲伤'],['angry','愤怒'],['afraid','害怕'],['tired','疲惫'],['surprised','惊讶'],['neutral','中性']].map(([id,label])=>['emotion',id,label,null,new RegExp('\\b'+id+'\\b','i')]),
 ['style','slow','缓慢',null,/\bslow(?:ly)?\b/i],['style','fast','快速',null,/\bfast\b/i],
];
const compare=(a,b)=>a<b?-1:a>b?1:0;
export function sourceDescription(row) {
  if(typeof row.source?.description==='string'&&row.source.description.trim())return row.source.description;
  const title=row.source?.mixamoName;
  const prefix=`Source title: ${title}. Source description: `;
  const suffix='. Draft from source text; playback not visually confirmed.';
  if(typeof title==='string'&&typeof row.descEn==='string'&&row.descEn.startsWith(prefix)&&row.descEn.endsWith(suffix)) {
    const text=row.descEn.slice(prefix.length,-suffix.length);return text.trim()?text:null;
  }
  return null;
}
export function sourceSemantics(row) {
  const description=sourceDescription(row),title=row.source?.mixamoName||row.id||'';
  const basis=description!==null?'description':title?'title':'missing',text=description??title;
  const claims=[],groups=new Set(),warnings=[];
  const staticPose=row.frames===2&&/\bpose\b/i.test(title);
  if(staticPose)groups.add('pose');
  const ballSport=/\b(?:golf|soccer|football|basketball|baseball)\b/i.test(text);
  const weapon=/\b(?:rifle|pistol|gun|firearm|bow|arrow)\b/i.test(text);
  const collect=(input,source,actionOnly=false)=>{
    for(const [facet,value,label,group,pattern] of RULES) {
      if(actionOnly&&facet!=='action')continue;
      for(const match of input.matchAll(new RegExp(pattern.source, 'gi'))) {
      if(value==='shoot'&&!weapon)continue;
      const prefix=input.slice(Math.max(0,match.index-80),match.index).split(/[,;.!?]|\b(?:but|then|while|and)\b/i).at(-1);
      const following=input.slice(match.index+match[0].length);
      if(value==='turn'&&/^\s+(?:(?:the|a|some)\s+)?(?:pages?|into|on|off)\b/i.test(following))continue;
      if(facet==='emotion'&&/\b(?:with|beside|near|to)\s+(?:an?\s+)?$/i.test(prefix)&&/^\s+(?:man|woman|person|people|child|boy|girl|friend|opponent)\b/i.test(following))continue;
      if(value==='walk'&&/^\s+stick\b/i.test(following)||value==='roll'&&/^\s+(?:(?:the|their|his|her)\s+)?(?:shoulders?|eyes?|head|wrists?|ankles?)\b/i.test(following))continue;
      if(/\b(?:no|not|without|never|cannot|isn't|doesn't|don't)\s+(?:\w+\s+){0,2}$/i.test(prefix)) {warnings.push('negated-mention-skipped');continue;}
      if(['punch','kick','slash','shoot','attack'].includes(value)&&(RECIPIENT.test(prefix+match[0])||/\b(?:dodg(?:e|ing)|evad(?:e|ing)|block(?:s|ed|ing)?)\s+(?:\w+\s+){0,4}$/i.test(prefix))) {warnings.push('opponent-action-not-performed');continue;}
      claims.push({facet:staticPose&&facet==='action'?'poseContext':facet,value,label:ballSport&&value==='kick'?'踢球':label,quote:match[0],start:match.index,end:match.index+match[0].length,source,status:'source-derived'});
      if(group&&!staticPose)groups.add(ballSport&&['kick','block','throw'].includes(value)?'daily':group);
      break;
      }
    }
  };
  collect(text,basis);
  // A title may fill an absent behavior, but never override explicit behavior,
  // negation or a receiver role in the primary Description.
  if(description!==null&&!staticPose&&!claims.some(c=>c.facet==='action')&&!warnings.length&&!RECIPIENT.test(text))collect(title,'title',true);
  if(!groups.size)groups.add(claims.some(c=>c.facet==='posture')?'posture':'other');
  if(description===null)warnings.push('source-description-unavailable');
  if(!staticPose&&!claims.some(c=>c.facet==='action'))warnings.push('unclassified-action');
  claims.sort((a,b)=>FACETS.indexOf(a.facet)-FACETS.indexOf(b.facet)||compare(a.value,b.value));
  return {version:1,basis,description,groups:BROWSE_GROUPS.filter(g=>groups.has(g.id)).map(g=>g.id),claims,
    unknownFacets:FACETS.filter(f=>!claims.some(c=>c.facet===f)),warnings:[...new Set(warnings)].sort(compare),status:'draft'};
}
export function summarizeSemantics(rows) {
  const groupCounts=Object.fromEntries(BROWSE_GROUPS.map(g=>[g.id,0]));let descriptions=0,unclassified=0;
  for(const row of rows){const a=sourceSemantics(row);if(a.basis==='description')descriptions++;if(a.groups.includes('other'))unclassified++;for(const g of a.groups)groupCounts[g]++;}
  return {dictionaryVersion:DICTIONARY_VERSION,total:rows.length,descriptions,titleFallback:rows.length-descriptions,unclassified,groupCounts};
}
