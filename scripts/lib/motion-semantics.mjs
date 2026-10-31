import * as legacy from './motion-semantics-v2.mjs';
/** Description-derived proposals. Never changes catalog approval or infers physical contact. */
export const DICTIONARY_VERSION = 'source-description-v3';
export const SUPPORTED_DICTIONARY_VERSIONS=Object.freeze([legacy.DICTIONARY_VERSION,DICTIONARY_VERSION]);
const versionCheck=version=>{if(!SUPPORTED_DICTIONARY_VERSIONS.includes(version))throw new Error('unsupported source dictionary version');return version;};
export const BROWSE_GROUPS = Object.freeze([
  ['locomotion','移动与转向'],['combat','战斗动作'],['dance','舞蹈'],['gesture','交谈与手势'],
  ['interaction','伸手与物体交互'],['daily','日常与运动'],['reaction','受击与反应'],['idle','待机'],['pose','静态姿势'],['posture','起坐与身体姿态'],['other','待分类'],
].map(([id,label])=>Object.freeze({id,label})));
const FACETS=['action','activity','role','posture','bodyPart','direction','gazeDirection','propMention','emotion','style','poseContext','contact','startPosture','endPosture','phases'];
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
 ['action','exercise','锻炼','daily',/\b(?:plank|push[ -]?ups?|sit[ -]?up|exercise|workout)\b/i],
 ['action','laugh','大笑','gesture',/\blaugh(?:s|ed|ing)?\b/i],
 ['action','cry','哭泣','gesture',/\b(?:cry|cries|cried|crying)\b/i],
 ['action','hit-reaction','受击','reaction',/\b(?:(?:receiv(?:e|es|ed|ing)|getting|got)\s+(?:a\s+)?(?:\w+\s+){0,2}hit|receiv(?:e|es|ed|ing)\s+(?:a|an|the)\s+(?:\w+\s+){0,2}(?:kick|punch)|hit\s+reaction|impact|flinch(?:es|ed|ing)?)\b/i],
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
// V3 additions are source-language patterns, not per-asset labels or physical claims.
// The frozen V2 module remains available for existing audit-log identities.
RULES.push(
 ['action','bang','拍击/敲击','interaction',/\bbang(?:s|ed|ing)?\b/i],
 ['action','pat','轻拍','interaction',/\bpat(?:s|ted|ting)\b/i],
 ['action','cheer','欢呼','gesture',/\bcheer(?:s|ed|ing)?\b/i],
 ['action','celebrate','庆祝','gesture',/\bcelebrat(?:e|es|ed|ing)\b/i],
 ['action','watch','观看','idle',/\bwatch(?:es|ed|ing)?\b/i],
 ['action','shout','喊叫','gesture',/\b(?:yell(?:s|ed|ing)?|shout(?:s|ed|ing)?|scream(?:s|ed|ing)?)\b/i],
 ['action','sneak','潜行','locomotion',/\bsneak(?:s|ed|ing)?\b/i],
 ['action','hang','悬挂','locomotion',/\b(?:hang(?:s|ing)?|hanging|freehang|braced\s+hang)\b/i],
 ['action','shimmy','悬挂横移','locomotion',/\bshimmy(?:ing)?\b/i],
 ['action','hang-drop','悬挂落下','locomotion',/\b(?:braced\s+hang|freehang|hang)\s+drop\b/i],
 ['action','hang-hop','悬挂跃移','locomotion',/\b(?:braced\s+hang|freehang|hang)\s+hop\b/i],
 ['action','lunge','前扑','locomotion',/\blung(?:e|es|ed|ing)\b/i],
 ['action','lean','倚靠/倾身','posture',/\blean(?:s|ed|ing)?\b/i],
 ['action','shiver','发抖','reaction',/\b(?:shiver(?:s|ed|ing)?|trembl(?:e|es|ed|ing))\b/i],
 ['action','warm-hands','暖手','interaction',/\bwarm(?:s|ed|ing)?\s+(?:(?:his|her|the|both)\s+)?hands\b/i],
 ['action','smile','微笑','gesture',/\bsmil(?:e|es|ed|ing)\b/i],
 ['action','bow','鞠躬','gesture',/\b(?:bow(?:ing|ed)|(?:(?:quick|formal|informal|courtly|deep)\s+){1,3}bow|bow(?=\s+(?:to|down|towards)\b))\b/i],
 ['action','nod','点头','gesture',/\bnod(?:s|ded|ding)?\b/i],
 ['action','shrug','耸肩','gesture',/\bshrug(?:s|ged|ging)?\b/i],
 ['action','grab','抓取','interaction',/\bgrab(?:s|bed|bing)?\b/i],
 ['action','put-down','放下','interaction',/\bput(?:s|ting)?\s+(?:(?:the|an?|his|her)\s+)?(?:\w+\s+){0,3}down\b/i],
 ['action','put-away','收起','interaction',/\bput(?:s|ting)?\s+(?:(?:the|an?|his|her)\s+)?(?:\w+\s+){0,3}(?:away|back)\b/i],
 ['action','place','放置','interaction',/\bplac(?:es|ed|ing)\b|\bplace(?=\s+(?:a|an|the|it|object)\b)/i],
 ['action','reload','装填','interaction',/\breload(?:s|ed|ing)?\b/i],
 ['action','play-instrument','演奏','daily',/\bplay(?:s|ed|ing)?\s+(?:an?\s+|the\s+)?(?:guitar|drums?|violin|piano|trumpet|flute|saxophone)\b/i],
 ['action','play-instrument','演奏','daily',/\bplay(?:s|ed|ing)?\s+(?:a\s+|the\s+)?(?:(?:short|long)\s+)?(?:piece|tune|song)\s+(?:on|with)\s+(?:a\s+|the\s+)?(?:guitar|drums?|violin|piano|trumpet|flute|saxophone)\b/i],
 ['action','pet','抚摸动物','interaction',/\bpet(?:ted|ting)\b|\bpet\s+(?:a|the)\s+(?:dog|cat|animal)\b/i],
 ['action','dig','挖掘','interaction',/\bdig(?:s|ging)?\b/i],
 ['action','water','浇水','interaction',/\bwater(?:s|ed|ing)\s+(?:with|a|the|plants?|flowers?)\b/i],
 ['action','milk','挤奶','daily',/\bmilk(?:s|ed|ing)\s+(?:a|the)\s+cow\b/i],
 ['action','operate-switch','操作开关','interaction',/\b(?:flip(?:s|ped|ping)?|operat(?:e|es|ed|ing))\s+(?:\w+\s+){0,2}switch(?:es)?\b/i],
 ['action','bite','咬','combat',/\bbit(?:e|es|ing)\b/i],
 ['action','stomp','跺脚','gesture',/\bstomp(?:s|ed|ing)?\b/i],
 ['action','spin','旋转','locomotion',/\bspin(?:s|ning)?\b/i],
 ['action','stretch','伸展','daily',/\bstretch(?:es|ed|ing)?\b/i],
 ['action','rub','揉擦','interaction',/\brub(?:s|bed|bing)?\b/i],
 ['action','shake-object','摇动物体','interaction',/\bshak(?:e|es|ing)\s+(?:\w+\s+){0,2}(?:dice|cup|bottle|object|them)\b/i],
 ['action','count','数数','gesture',/\bcount(?:s|ed|ing)\b/i],
 ['action','deal-cards','发牌','interaction',/\bdeal(?:s|t|ing)?\s+cards\b/i],
 ['action','sweep','扫腿','combat',/\bleg\s+sweep\b/i],
 ['action','fist-pump','握拳振臂','gesture',/\bfist\s+pump\b|\bpump(?:s|ed|ing)?\s+(?:a\s+|the\s+)?fist\b/i],
 ['action','thumbs-up','竖拇指','gesture',/\bthumbs?\s+up\b/i],
 ['action','wag-finger','摇指示意','gesture',/\b(?:shak(?:e|es|ing)|wag(?:s|ged|ging)?)\s+(?:(?:a|the|his|her)\s+)?finger\b/i],
 ['action','cover-face','遮脸','gesture',/\b(?:cover(?:s|ed|ing)?|shield(?:s|ed|ing)?)\s+(?:(?:the|his|her)\s+)?face\b/i],
 ['action','inspect','检查/端详','idle',/\b(?:inspect(?:s|ed|ing)?|examin(?:e|es|ed|ing))\b/i],
 ['action','search','搜寻','interaction',/\bsearch(?:es|ed|ing)?\b/i],
 ['action','search','搜寻','interaction',/\blook(?:s|ed|ing)?\s+up\s+(?:a\s+|the\s+)?(?:phone\s+number|word|address|information|number|record|name|definition|entry|fact|answer)\b/i],
 ['action','gather','收集','interaction',/\b(?:gather(?:s|ed|ing)?|collect(?:s|ed|ing)?)\b/i],
 ['action','blow-kiss','飞吻','gesture',/\bblow(?:s|ing)?\s+(?:a\s+|the\s+)?kiss\b/i],
 ['action','kiss','亲吻','interaction',/\bkiss(?:es|ed|ing)?\b/i],
 ['action','argue','争论','gesture',/\bargu(?:e|es|ed|ing)\b/i],
 ['action','tell-secret','说悄悄话','gesture',/\btell(?:s|ing)?\s+(?:a\s+)?secret\b/i],
 ['action','yawn','打哈欠','idle',/\byawn(?:s|ed|ing)?\b/i],
 ['action','float','漂浮','locomotion',/\bfloat(?:s|ed|ing)?\b/i],
 ['action','flail','挥舞四肢','reaction',/\bflail(?:s|ed|ing)?\b/i],
 ['action','stumble','踉跄','reaction',/\b(?:stumbl(?:e|es|ed|ing)|tripp(?:ed|ing)|slipp(?:ed|ing))\b/i],
 ['action','pivot','轴转','locomotion',/\bpivot(?:s|ed|ing)?\b|\brotate\s+from\s+(?:the\s+)?front\s+foot\b/i],
 ['action','enter','进入','locomotion',/\benter(?:s|ed|ing)\b/i],
 ['action','swing','摆荡/挥动','interaction',/\bswing(?:s|ing)?\b/i],
 ['action','catch','接住','interaction',/\bcatch(?:es|ing)?\b/i],
 ['action','dive','扑身/跳水','locomotion',/\bdiv(?:e|es|ed|ing)\b/i],
 ['action','sidestep','侧步','locomotion',/\bsidestep(?:s|ped|ping)?\b/i],
 ['action','juggle','颠球/抛接','daily',/\bjuggl(?:e|es|ed|ing)\b/i],
 ['action','dribble','运球','daily',/\bdribbl(?:e|es|ed|ing)\b/i],
 ['action','pitch','投球','daily',/\bpitch(?:es|ed|ing)\b/i],
 ['action','warm-up','热身','daily',/\bwarm(?:s|ed|ing)?\s+up\b/i],
 ['action','disarm','解除武装/卸械','interaction',/\bdisarm(?:s|ed|ing)?\b/i],
 ['action','vault','翻越','locomotion',/\bvault(?:s|ed|ing)?\s+over\b/i],
 ['action','hide','躲藏','posture',/\bhid(?:e|es|ing)\b/i],
 ['action','take-item','拿取物品','interaction',/\btak(?:e|es|ing)\s+(?:an?\s+|the\s+)?(?:item|object)\b/i],
 ['action','lower-object','放低物体','interaction',/\blower(?:s|ed|ing)?\s+(?:(?:a|the)\s+)?(?:pistol|rifle|object|weapon)\b/i],
 ['action','wheelchair-move','轮椅移动','locomotion',/\bmov(?:e|es|ed|ing)\s+in\s+(?:a\s+)?wheelchair\b/i],
 ['action','light-fire','点燃','interaction',/\blight(?:s|ed|ing)?\s+(?:an?\s+|the\s+)?(?:torch|cigarette|match|fire|candle)\b/i],
 ['action','smoke','吸烟','daily',/\bsmok(?:e|es|ed|ing)\b/i],
 ['action','strike-match','擦火柴','interaction',/\b(?:strik(?:e|es|ing)|struck)\s+(?:(?:a|the)\s+)?match\b/i],
 ['action','electrocution-reaction','触电反应','reaction',/\bbeing\s+electrocuted\b/i],
 ['action','thrown-reaction','被抛动作','reaction',/\bbeing\s+thrown\b/i],
 ['action','placement-reaction','被放置','reaction',/\bbeing\s+(?:\w+ly\s+){0,2}placed\b/i],
 ['role','recipient','受方','reaction',/\b(?:being|getting)\s+(?:\w+ly\s+){0,2}(?:placed|petted|kissed|grabbed|strangled|electrocuted)\b/i],
 ['action','rally','鼓动','gesture',/\brally(?:ing)?\b/i],
 ['action','photograph','拍摄','daily',/\bshoot(?:s|ing)?\s+(?:a\s+|the\s+)?(?:photographs?|photos?|pictures?|films?|videos?)\b/i],
 ['action','type-input','输入信息','interaction',/\benter(?:s|ed|ing)?\s+(?:an?\s+|the\s+)?(?:access\s+)?(?:code|password|pin|data|text|number)\b/i],
 ['action','strangle-reaction','被勒反应','reaction',/\b(?:being|getting)\s+strangled\b/i],
 ['action','posture-transition','姿态转换','posture',/\b(?:stand(?:ing)?|sit(?:ting)?|seated|crouch(?:ed|ing)?|kneel(?:ing)?|prone|lying|laying)\b(?:\s+\w+){0,4}\s+to\s+(?:stand(?:ing)?|sit(?:ting)?|seated|crouch(?:ed|ing)?|kneel(?:ing)?|prone|lying|laying)\b|\b(?:stand(?:ing)?|sit(?:ting)?|crouch(?:ed|ing)?|kneel(?:ing)?)\s+(?:up\s+)?from\s+(?:a\s+)?(?:stand(?:ing)?|sit(?:ting)?|seated|crouch(?:ed|ing)?|kneel(?:ing)?|prone|lying|laying)\b/i],
 ['action','state-transition','状态切换','posture',/\b(?:cover|ready)\b.{0,35}\bto\b.{0,35}\b(?:cover|ready)\b/i],
 ['action','stand-up','起身站立','posture',/\bstand(?:ing)?\s+up\b/i],
 ['action','sit-down','坐下','posture',/\bsit(?:ting)?\s+down\b/i],
 ['action','exercise','锻炼','daily',/\b(?:sit[ -]?ups?|crunch(?:es)?|kettlebell\s+(?:swing|snatch|lift|clean)|cycling\s+legs)\b/i],
 ['action','equip','装备/收放','interaction',/\bdraw(?:s|ing)?\s+(?:a\s+|the\s+)?(?:sword|pistol|rifle)\b/i],
 ['action','pick-up','拾取','interaction',/\bpick(?:s|ed|ing)?\s+(?:a\s+|the\s+)?(?:(?:low|high|ripe|fresh|hanging)\s+){0,3}(?:fruit|flowers)\b/i],
 ['action','hit-reaction','受击','reaction',/\breaction\s+(?:to\s+)?(?:hit|shove|punch|kick|shot)\b/i],
 ['action','shoot','射击','combat',/\bshoot(?:s|ing)?\b/i],
 ['emotion','angry','愤怒',null,/\b(?:angrily|highly\s+aggravated)\b/i],
 ['emotion','happy','高兴',null,/\bhappily\b/i],
 ['emotion','sad','悲伤',null,/\bsadly\b/i],
 ['emotion','afraid','害怕',null,/\b(?:terrified|fearful)\b/i],
 ['emotion','ashamed','羞愧',null,/\b(?:ashamed|shame)\b/i],
 ['emotion','relieved','释然',null,/\brelief\b/i],
 ['emotion','disbelief','难以置信',null,/\bdisbelief\b/i],
 ['activity','meeting','开会',null,/\bmeeting\b/i],
 ['propMention','wall','墙',null,/\bwall\b/i],
 ['propMention','shovel','铲',null,/\bshovel\b/i],
 ['propMention','matchbox','火柴盒',null,/\bmatchbox\b/i],
 ['propMention','match','火柴',null,/\bmatches?\b/i],
 ['propMention','stove','火炉',null,/\bstove\b/i],
 ['propMention','campfire','营火',null,/\bcampfire\b/i],
 ['propMention','guitar','吉他',null,/\bguitar\b/i],
 ['propMention','drums','鼓',null,/\bdrums?\b/i],
 ['propMention','violin','小提琴',null,/\bviolin\b/i],
 ['propMention','dice','骰子',null,/\bdice\b/i],
 ['propMention','cards','纸牌',null,/\bcards\b/i],
 ['propMention','fruit','果实',null,/\bfruit\b/i],
 ['bodyPart','hands','手',null,/\bhands\b/i],
 ['bodyPart','arms','手臂',null,/\barms\b/i],
 ['bodyPart','legs','腿',null,/\blegs\b/i],
 ['gazeDirection','up','向上',null,/\b(?:look(?:s|ed|ing)?|gaze|examin(?:e|ing)|inspect(?:s|ing)?)\s+up(?:wards?)?\b/i],
 ['gazeDirection','down','向下',null,/\b(?:look(?:s|ed|ing)?|gaze|examin(?:e|ing)|inspect(?:s|ing)?)\s+down(?:wards?)?\b/i],
 ['gazeDirection','left','视线向左',null,/\b(?:look(?:s|ed|ing)?|gaze|examin(?:e|ing)|inspect(?:s|ing)?)\s+(?:to\s+)?(?:the\s+)?left\b/i],
 ['gazeDirection','right','视线向右',null,/\b(?:look(?:s|ed|ing)?|gaze|examin(?:e|ing)|inspect(?:s|ing)?)\s+(?:to\s+)?(?:the\s+)?right\b/i],
 ['gazeDirection','forward','视线向前',null,/\b(?:look(?:s|ed|ing)?|gaze|examin(?:e|ing)|inspect(?:s|ing)?)\s+forwards?\b/i],
 ['direction','sideways','向侧方',null,/\bsideways\b/i],
 ['style','fast','快速',null,/\bquickly\b/i],
 ['style','slow','缓慢',null,/\bslowly\b/i],
 ['poseContext','arms-raised','抬臂姿态',null,/\barms\s+raised\b/i],
 ['poseContext','arms-at-sides','双臂在体侧',null,/\barms\s+(?:hanging\s+)?at\s+(?:(?:his|her|the)\s+)?sides\b/i],
 ['poseContext','arms-lowered','垂臂姿态',null,/\barms\s+(?:hanging\s+)?down\b/i],
 ['poseContext','arms-crossed','抱臂姿态',null,/\barms\s+crossed\b/i],
 ['poseContext','legs-crossed','交腿姿态',null,/\blegs\s+crossed\b/i],
);

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
export function sourceSemantics(row,{dictionaryVersion=DICTIONARY_VERSION}={}) {
  versionCheck(dictionaryVersion);if(dictionaryVersion===legacy.DICTIONARY_VERSION)return legacy.sourceSemantics(row);
  const description=sourceDescription(row),title=row.source?.mixamoName||row.id||'';
  const basis=description!==null?'description':title?'title':'missing',text=description??title;
  const claims=[],groups=new Set(),warnings=[];
  const staticPose=row.frames===2&&/\bpose\b/i.test(title);
  if(staticPose)groups.add('pose');
  const ballSport=/\b(?:golf|soccer|football|basketball|baseball)\b/i.test(text);
  const sportsContext=ballSport||/\b(?:golf|soccer|football|basketball|baseball)\b/i.test(title);
  const weapon=/\b(?:rifle|pistol|gun|firearm|bow|arrow)\b/i.test(text);
  const otherPerformer=(input,index,following='')=>{
    const context=input.slice(0,index).split(/[,;.!?]|\b(?:but|then|while)\b/i).at(-1);
    if(/\bwatch(?:es|ed|ing)?\s+(?:(?:a|an|the)\s+)?(?:\w+\s+){0,2}(?:man|woman|person|someone|another|crowd|people|him|her|them)\b/i.test(context))return true;
    if(/\b(?:make|making|tell|telling|ask|asking|encourage|encouraging|rally|rallying)\s+(?:them|the\s+crowd|people|someone)\s+(?:to\s+)?$/i.test(context))return true;
    return /^\s+(?:cat|dog|animal|baby|man|woman|person|child|crowd|people)\b/i.test(following)&&/\b(?:(?:petting|watching|watched|holding|carrying|kissing|chasing|feeding)\s+(?:a|an|the)\s+|(?:with|beside|near|behind|past|among|about)\s+(?:(?:a|an|the)\s+)?)(?:\w+\s+){0,3}$/i.test(context);
  };
  const collect=(input,source,actionOnly=false)=>{
    for(const [facet,value,label,group,pattern] of RULES) {
      if(actionOnly&&facet!=='action')continue;
      for(const match of input.matchAll(new RegExp(pattern.source, 'gi'))) {
      if(value==='shoot'&&(!/\bshoot(?:s|ing)?\b/i.test(match[0])&&!weapon||sportsContext&&!weapon))continue;
      if(['pitch','dribble'].includes(value)&&!sportsContext&&!/\bball\b/i.test(input))continue;
      if(value==='match'&&!/\b(?:strik\w*|struck|light\w*|burn\w*|flame|matchbox)\b/i.test(input))continue;
      const effectiveFacet=staticPose&&facet==='action'?'poseContext':facet;
      const previous=claims.findIndex(c=>c.facet===effectiveFacet&&c.value===value);
      const prefix=input.slice(Math.max(0,match.index-80),match.index).split(/[,;.!?]|\b(?:but|then|while|and)\b/i).at(-1);
      const following=input.slice(match.index+match[0].length);
      if(facet!=='propMention'&&otherPerformer(input,match.index,following)){warnings.push('other-performer-mention-skipped');continue;}
      if(value==='shoot'&&/^\s+(?:(?:a|an|the)\s+)?(?:photographs?|photos?|pictures?|films?|movies?|videos?)\b/i.test(following))continue;
      if(facet==='action'&&/\bwatch(?:ing)?\s+(?:(?:a|the)\s+)?(?:(?:man|woman|person|someone|another)\s+)(?:\w+\s+){0,3}$/i.test(prefix)){warnings.push('other-performer-mention-skipped');continue;}
      if(facet==='bodyPart'&&value==='hands'&&/\b(?:both|two)\s+$/i.test(prefix))continue;
      if(value==='posture-transition'&&/\b(?:ready|preparing|trying|wanting|about)\s+to\b/i.test(match[0]))continue;
      if(facet==='action'&&!value.endsWith('-reaction')&&/\b(?:be|been|being|getting)\s+(?:\w+\s+){0,3}$/i.test(prefix)&&/^(?:placed|grabbed|caught|thrown|kissed|petted|bitten|put\b|equipped|disarmed)/i.test(match[0])){warnings.push('passive-action-not-performed');continue;}
      if(facet==='action'&&/\b(?:make|making|tell|telling|ask|asking|encourage|encouraging)\s+(?:them|the\s+crowd|people|someone)\s+(?:to\s+)?$/i.test(prefix)){warnings.push('other-performer-mention-skipped');continue;}
      if(value==='kiss'&&/\bblow(?:s|ing)?\s+(?:a\s+|the\s+)?$/i.test(prefix))continue;
      const readiness=/(?:\b(?:getting\s+ready|ready|preparing|trying|wanting|about|going)\s+to)(?:\s+(?:\w+ly|very|quite|just)){0,3}\s+$/i.exec(input.slice(0,match.index));
      const purpose=facet==='action'?/\bto(?:\s+(?:\w+ly|very|quite|just)){0,3}\s+$/i.exec(input.slice(0,match.index)):null;
      const intent=(facet==='action'||facet==='posture')?(readiness??purpose):null;
      const intentOnly=!!intent;
      if(intentOnly)warnings.push('intended-action-phase-unverified');
      if(value==='disarm'&&!/\b(?:opponent|enemy|own|himself|herself)\b/i.test(input))warnings.push('interaction-role-unresolved');
      if(value==='enter'&&/^\s+(?:(?:a|an|the)\s+)?(?:access\s+)?(?:code|password|pin|data|text|number)\b/i.test(following))continue;
      if(value==='hang'&&/\b(?:arms?|hands?|legs?)\s+$/i.test(prefix)&&/^\s+(?:down|loose|freely|at\s+(?:(?:his|her|the)\s+)?sides)\b/i.test(following))continue;
      if(value==='look'&&/^\s+up\s+(?:(?:a|the)\s+)?(?:phone\s+number|word|address|information|number|record|name|definition|entry|fact|answer)\b/i.test(following))continue;
      if(facet==='gazeDirection'&&value==='up'&&/^\s+(?:(?:a|the)\s+)?(?:phone\s+number|word|address|information|number|record|name|definition|entry|fact|answer)\b/i.test(following))continue;
      if((value==='look'||facet==='gazeDirection')&&/forward/i.test(match[0]+following.slice(0,12))&&/^\s*(?:forwards?\s+)?to\b/i.test(following))continue;
      if(value==='hang'&&/^\s+(?:fruit|branches?|clothes|lamp|arms?|hands?|legs?)\b/i.test(following))continue;
      if(value==='light-fire'&&/^light\s/i.test(match[0])&&/\b(?:a|an|the)\s+$/i.test(prefix))continue;
      if(facet==='propMention'&&value==='bow'&&!/\b(?:arrow|arrows|archery|weapon)\b/i.test(input)&&! /\b(?:with|hold(?:ing)?|carry(?:ing)?|pull(?:ing)?|draw(?:ing)?)\s+(?:a\s+|the\s+)?$/i.test(prefix))continue;
      if(facet==='posture'&&value==='lying'&&/^on\s+(?:the\s+)?back$/i.test(match[0])&&prefix.trim()&&!/\b(?:lying|laying|reclined)\s*$/i.test(prefix))continue;
      if(value==='fall'&&/^(?:stumble|tripping)$/i.test(match[0]))continue;
      if(value==='close'&&/^close$/i.test(match[0])&&/^\s+to\b/i.test(following))continue;
      if(value==='point'&&/^point$/i.test(match[0])&&/\bat\s+(?:(?:this|that|the|a)\s+)?$/i.test(prefix))continue;
      if(value==='turn'&&/^\s+(?:(?:the|a|some)\s+)?(?:pages?|into|on|off)\b/i.test(following))continue;
      if(facet==='emotion'&&/\b(?:with|beside|near|to)\s+(?:an?\s+)?$/i.test(prefix)&&/^\s+(?:man|woman|person|people|child|boy|girl|friend|opponent)\b/i.test(following))continue;
      if(value==='walk'&&/^\s+stick\b/i.test(following)||value==='roll'&&/^\s+(?:(?:the|their|his|her)\s+)?(?:shoulders?|eyes?|head|wrists?|ankles?)\b/i.test(following))continue;
      if(/\b(?:no|nobody|no\s+one|not|without|never|cannot|isn't|doesn't|don't)\s+(?:\w+\s+){0,2}$/i.test(prefix)) {warnings.push('negated-mention-skipped');continue;}
      if(['punch','kick','slash','shoot','attack'].includes(value)&&(RECIPIENT.test(prefix+match[0])||/\b(?:dodg(?:e|ing)|evad(?:e|ing)|block(?:s|ed|ing)?)\s+(?:\w+\s+){0,4}$/i.test(prefix))) {warnings.push('opponent-action-not-performed');continue;}
      if(previous>=0){if(claims[previous].intentOnly&&!intentOnly)claims.splice(previous,1);else continue;}
      const start=intent?intent.index:match.index,end=match.index+match[0].length;
      claims.push({facet:effectiveFacet,value,label:ballSport&&value==='kick'?'踢球':label,quote:input.slice(start,end),start,end,source,status:'source-derived',...(intentOnly?{intentOnly:true}:{})});
      if(group&&!staticPose)groups.add(ballSport&&['kick','block','throw'].includes(value)?'daily':group);
      if(!intentOnly)break;
      }
    }
  };
  const postureTransitions=()=>{
    if(staticPose)return;
    const state='(?:lying\\s+prone|laying\\s+prone|standing|stand|sitting|seated|sit|crouching|crouched|crouch|kneeling|kneel|prone|lying|laying)';
    const edges=[],edgeKeys=new Set();
    for(const [connector,reverse] of [['to',false],['from',true]]){
      // Lookahead includes overlapping state chains (X to Y to Z), which must stay ambiguous.
      const pattern=new RegExp('(?=(\\b('+state+')(\\s+\\w+){0,3}?\\s+'+connector+'\\s+(?:a\\s+|the\\s+)?('+state+')\\b))','gi');
      for(const match of text.matchAll(pattern)){
        const whole=match[1],prefix=text.slice(Math.max(0,match.index-70),match.index).split(/[,;.!?]|\b(?:but|then|while|and)\b/i).at(-1);
        if(otherPerformer(text,match.index)||/\b(?:not|never|without|nobody|no\s+one)\s+(?:\w+\s+){0,3}$/i.test(prefix)||/\b(?:ready|preparing|trying|wanting|about|going)\s+to\s*$/i.test(prefix)||/\b(?:ready|preparing|trying|wanting|about)\s+to\b/i.test(whole))continue;
        const first={quote:match[2],start:match.index,end:match.index+match[2].length};
        const offset=match.index+whole.lastIndexOf(match[4]);
        const second={quote:match[4],start:offset,end:offset+match[4].length};
        const pair=reverse?[second,first]:[first,second],key=pair[0].end+':'+pair[1].start;
        if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push(pair);}
      }
    }
    if(edges.length!==1){if(edges.length>1)warnings.push('ambiguous-posture-sequence');return;}
    const postureValue=quote=>/prone/i.test(quote)?'prone':/^stand/i.test(quote)?'standing':/^(?:sit|seat)/i.test(quote)?'seated':/^crouch/i.test(quote)?'crouched':/^kneel/i.test(quote)?'kneeling':'lying';
    if(postureValue(edges[0][0].quote)===postureValue(edges[0][1].quote)){const n=claims.findIndex(c=>c.facet==='action'&&c.value==='posture-transition');if(n>=0)claims.splice(n,1);}
    for(const [n,span] of edges[0].entries()){
      const value=postureValue(span.quote),label=RULES.find(r=>r[0]==='posture'&&r[1]===value)[2];
      claims.push({facet:n===0?'startPosture':'endPosture',value,label,...span,source:basis,status:'source-derived'});
    }
  };
  collect(text,basis);
  postureTransitions();
  // A title may fill an absent behavior, but never override explicit behavior,
  // negation or a receiver role in the primary Description.
  if(description!==null&&!staticPose&&!claims.some(c=>c.facet==='action')&&!warnings.length&&!RECIPIENT.test(text))collect(title,'title',true);
  if(description!==null&&staticPose&&!claims.some(c=>c.facet==='posture')){
    for(const [facet,value,label,,pattern] of RULES.filter(r=>r[0]==='posture')){const match=new RegExp(pattern.source,'i').exec(title);if(match)claims.push({facet,value,label,quote:match[0],start:match.index,end:match.index+match[0].length,source:'title',status:'source-derived'});}
  }
  if(!groups.size)groups.add(claims.some(c=>c.facet==='posture')?'posture':'other');
  if(description===null)warnings.push('source-description-unavailable');
  if(!staticPose&&!claims.some(c=>c.facet==='action'))warnings.push(claims.some(c=>c.facet==='posture')?'posture-only-no-behavior-described':'unclassified-action');
  claims.sort((a,b)=>FACETS.indexOf(a.facet)-FACETS.indexOf(b.facet)||compare(a.value,b.value));
  return {version:1,basis,description,groups:BROWSE_GROUPS.filter(g=>groups.has(g.id)).map(g=>g.id),claims,
    unknownFacets:FACETS.filter(f=>!claims.some(c=>c.facet===f)),warnings:[...new Set(warnings)].sort(compare),status:'draft'};
}
export function summarizeSemantics(rows,{dictionaryVersion=DICTIONARY_VERSION}={}) {
  versionCheck(dictionaryVersion);
  const groupCounts=Object.fromEntries(BROWSE_GROUPS.map(g=>[g.id,0]));let descriptions=0,unclassified=0;
  for(const row of rows){const a=sourceSemantics(row,{dictionaryVersion});if(a.basis==='description')descriptions++;if(a.groups.includes('other'))unclassified++;for(const g of a.groups)groupCounts[g]++;}
  return {dictionaryVersion,total:rows.length,descriptions,titleFallback:rows.length-descriptions,unclassified,groupCounts};
}


// Public, read-only taxonomy. Derive it from the classifier's own rules; consumers
// must never copy a second facet/value table or treat this as label approval.
const freeze=(value)=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const dictionary=freeze({schemaVersion:1,dictionaryVersion:DICTIONARY_VERSION,groups:BROWSE_GROUPS,
  facets:FACETS.map(id=>({id,values:[...new Map(RULES.filter(([facet])=>facet===id||(id==='poseContext'&&facet==='action')||(['startPosture','endPosture'].includes(id)&&facet==='posture')).map(([,value,label,group])=>[value,{value,defaultLabel:label,defaultGroup:id==='poseContext'?null:group}])).values()].sort((a,b)=>compare(a.value,b.value))})),
});
/** Immutable taxonomy metadata, not an accuracy or approval statement. */
export function getSourceDictionary(version=DICTIONARY_VERSION){versionCheck(version);return version===legacy.DICTIONARY_VERSION?legacy.getSourceDictionary():dictionary;}
/** Unknown values remain unknown; does not create or register new labels. */
export function getSourceTagDefinition(facet,value,version=DICTIONARY_VERSION){
  versionCheck(version);if(version===legacy.DICTIONARY_VERSION)return legacy.getSourceTagDefinition(facet,value);
  if(typeof facet!=='string'||typeof value!=='string'||facet.length>64||value.length>128)throw new Error('invalid source tag query');
  return dictionary.facets.find(item=>item.id===facet)?.values.find(item=>item.value===value)??null;
}
/** Validate a literal source span only. It does not prove the proposed semantics. */
export function validateSourceEvidence(row,evidence){
  if(!row||typeof row!=='object'||Array.isArray(row)||!evidence||typeof evidence!=='object'||Array.isArray(evidence))throw new Error('invalid source evidence');
  if(Object.keys(evidence).some(key=>!['source','quote','start','end'].includes(key)))throw new Error('unknown source evidence field');
  const {source,quote,start,end}=evidence;
  const text=source==='description'?sourceDescription(row):source==='title'?(row.source?.mixamoName||row.id):null;
  if(typeof text!=='string'||typeof quote!=='string'||!quote.length||quote.length>4000||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>text.length||text.slice(start,end)!==quote)throw new Error('source evidence span mismatch');
  return {source,quote,start,end};
}
