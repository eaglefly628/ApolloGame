/** Story-specific draft retrieval, never a coverage, contact or visual approval certificate. */
import {sourceDescription} from '../../scripts/lib/motion-semantics.mjs';

const sources = [
  {path:'docs/design/game628/brief.md',section:'章节（原著顺序）'},
  {path:'docs/design/game628/gdd.md',section:'§2 核心循环 / §3 章节设计 / §7 美术方向'},
  {path:'docs/design/game628/design-freeze.md',section:'3D 绑骨与动作：七项动作清单'},
];
// These expressions retrieve source references only. They do not classify or approve clips.
const definitions = [
  ['girl-shiver','0','缩坐发抖','clip','needs-authoring','design-seven',/\b(?:shiver\w*|trembl\w*)\b|\bsitting\s+(?:with\s+breathing\s+idle|(?:reclined\s+)?on\s+the\s+floor|cross\s+legged|against\s+a\s+wall)\b/i,'缩坐与寒冷发抖需分镜核对；坐姿候选只提供局部参考，当前站定上肢后端不承诺下肢平衡'],
  ['strike-match','1,2,3,5','擦火柴','interaction','runtime-socket','design-seven',/\b(?:strik\w*\s+(?:a\s+)?match|lighting\s+(?:a\s+)?cigarette|smoking)\b/i,'已有单样例表意确认；Socket 端点不等于抓握/穿插/全 Skin 验收'],
  ['warm-hands','1','伸手取暖','interaction','needs-authoring','design-seven',/\bwarming\s+hands\b/i,'可复用候选身体姿态；火炉位置、双手方向、距离与穿插仍需制作验证'],
  ['look-up','3,4','仰望','clip','existing-clip','design-seven',/\blook(?:s|ing)?\s+(?:upwards?|at\s+(?:the\s+)?sky)\b/i,'候选可能是静态姿势；运行时头随未烘焙，不代表整段仰望通过'],
  ['smile-wall','7','微笑倚墙','clip','needs-authoring','design-seven',/\bleaning\b.*\bwall\b/i,'倚墙只覆盖身体参考；微笑、呼吸和墙面接触另核对，不由手部 IK 自动获得'],
  ['grandma-reach','5','奶奶伸手','clip','needs-authoring','design-seven',/\breaching\s+out\b|\bextend\w*\s+(?:a\s+)?hand\b/i,'上肢目标可用于候选制作；奶奶体型、表意和手指尚未验证'],
  ['grandma-lift','6','奶奶抱起小女孩','multi-character','out-of-scope','design-seven',/\b(?:hug\w*|embrac\w*)\b|\b(?:lift\w*|carry\w*)\s+(?:a\s+)?(?:child|person|girl)\b/i,'需要双人接触、承重和平衡；当前站定单人上肢后端不覆盖'],
  ['street-pedestrians','0','雪夜行人行走','clip','existing-clip','gdd',/\bwalking\s+forward\b|\bwalk\s+forward\b/i,'步态可选；场景路线、人群布置和落地另验'],
  ['girl-corner','0','小女孩缩进墙角','clip','needs-authoring','gdd',/\bsitting\s+down\b|\bstanding\b.*\bto\s+crouched\b/i,'需要到墙角的位置衔接、下肢和贴墙校验，不能仅靠站定手部 IK'],
  ['feet-stove','1','向火炉伸脚','interaction','needs-authoring','gdd',/\b(?:extend\w*|stretch\w*)\s+(?:(?:her|his|the|a)\s+)?(?:feet|foot|legs)\b/i,'需坐姿下肢与炉体距离；手部求解模板不覆盖'],
  ['match-props','1,2,3,5,6','火柴与火柴盒随手挂接','interaction','runtime-socket','gdd',null,'已有 Socket 制作/运行时原型；每 Skin 握点和接触须独立校准'],
  ['match-flame','1,2,3,5,6','火花、燃烧、护火与熄灭','scene','needs-authoring','gdd',null,'时间线、火苗资源和粒子场景编排，非 humanoid 动作片段'],
  ['vision-fade','1,2,3,5','幻象显现、墙透明与消退','scene','needs-authoring','gdd',null,'场景材质、光照及时间线编排，不由骨骼 IK 补足'],
  ['roast-goose','2','插着刀叉的烤鹅走来','scene','needs-authoring','gdd',null,'文档为烤鹅；非人道具/角色，需专用绑定或路径动画，不能套 humanoid 动作'],
  ['candles-stars','3','烛光升起变星星','scene','needs-authoring','gdd',null,'粒子与物体路径、亮度及变换的场景制作'],
  ['falling-star','4','流星划落','scene','needs-authoring','gdd',null,'环境路径与特效，不检索人体动作作为已满足'],
  ['whole-hand-matches','6','整把火柴擦亮并同燃','interaction','needs-authoring','gdd',null,'单根擦火柴不自动覆盖整把道具握持；需新的握点、道具和接触验证'],
  ['ascent','6','奶奶与女孩一起升高','multi-character','out-of-scope','gdd',null,'双人抱持同步与场景升空需独立制作，不承诺当前单人 IK 可完成'],
];

function references(rows, pattern) {
  if (!pattern) return [];
  return rows.flatMap(row=>{
    const description=sourceDescription(row);
    const basis=description===null?'title-fallback':'description';
    const text=description??row.source?.mixamoName??'';
    const match=pattern.exec(text);
    if(!match) return [];
    return [{id:row.id,sha256:row.sha256,description,evidenceQuote:text,
      basis,scope:row.derivedFrom?'base-reference':'clip-source',
      rationale:{matchedQuote:match[0],start:match.index,end:match.index+match[0].length},
      status:'candidate-only',visualStatus:'not-visually-verified'}];
  }).sort((a,b)=>Number(a.scope==='base-reference')-Number(b.scope==='base-reference')||
    Number(a.basis==='title-fallback')-Number(b.basis==='title-fallback')||a.id.localeCompare(b.id,'en')).slice(0,3);
}

/** Pure proposal. Reads no files, changes no catalog rows, and makes no missing-library claim. */
export function buildMatchGirlPlan(libraryCatalog) {
  if(!libraryCatalog||!Array.isArray(libraryCatalog.clips)) throw new TypeError('libraryCatalog.clips must be an array');
  const ids=new Set();
  for(const row of libraryCatalog.clips){
    if(!row||typeof row.id!=='string'||!row.id||!(/^[a-f0-9]{64}$/i.test(row.sha256??''))||ids.has(row.id))
      throw new TypeError('clip identity requires unique id and SHA256');
    ids.add(row.id);
  }
  const requirements=definitions.map(([id,chapter,label,category,method,origin,pattern,note])=>{
    const candidates=references(libraryCatalog.clips,pattern);
    return {id,chapter,label,category,method,origin,implementationStatus:
      id==='strike-match'?'expression-confirmed-only':method==='runtime-socket'?'prototype-needs-per-skin-validation':
      method==='out-of-scope'?'outside-current-single-person-backend':'story-result-not-implemented-or-verified',
      candidates,missingStatus:candidates.length?'candidate-only':'not-visually-verified',
      retrievalStatus:pattern?(candidates.length?'source-references-found':'no-reference-found-by-this-query'):'not-a-humanoid-clip-query',
      verification:{storyComplete:false,expressionConfirmed:id==='strike-match',scope:id==='strike-match'?'user-confirmed-single-example-expression':'unverified',
        ...(id==='strike-match'?{reference:{candidateId:'generated-4d41f703a6db6b750801',version:'v022',skin:'Claire',basis:'user-expression-confirmation',limitations:'仅一次表意认可；不代表碰撞、手指、全角色或整故事验收'}}:{})},note};
  });
  return {id:'game628-match-girl-draft',title:'《最后的火柴》· 故事动画补全集草案',status:'draft',sources:sources.map(s=>({...s})),
    assumptions:['按用户确认的《卖火柴的小女孩》原作及 game628 已有设计；烤鹅而非烤鸭','来源文字匹配只是候选，不证明动作、接触或分镜已满足','未命中检索不表示2445库中没有；场景和双人项目单列'],
    requirements,counts:{requirementItems:requirements.length,designChecklistItems:7,
      requirementsWithCandidates:requirements.filter(r=>r.candidates.length).length,
      candidateReferences:requirements.reduce((n,r)=>n+r.candidates.length,0),
      notVisuallyVerifiedRequirements:requirements.length,
      withoutExpressionConfirmation:requirements.filter(r=>!r.verification.expressionConfirmed).length,
      unverifiedCompleteRequirements:requirements.length,verifiedStoryRequirements:0,
      verifiedExpressionExamples:requirements.filter(r=>r.verification.expressionConfirmed&&r.verification.reference).length,libraryClipCount:libraryCatalog.clips.length}};
}
