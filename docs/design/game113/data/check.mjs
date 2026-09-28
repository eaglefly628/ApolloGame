#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  game113 爱好包校验器（设计期数据门·零依赖）
//
//  用法：node docs/design/game113/data/check.mjs [--release] <file.hobby.json | file.index.json ...>
//        不给文件 = 校验 data/examples/ 下全部 *.hobby.json 与 *.index.json
//  *.index.json = 某门爱好的每日行情指数序列（须与同目录 <hobby>.hobby.json 配对）。
//  --release：上线门——所有被引用的知识卡须 reviewed/owner-claim，图片须有 sha256 与授权。
//  退出码：有 error = 1；只有 warn = 0。
//
//  两段：① 按 collectible.schema.json 做结构校验（本文件内置一个够用的 JSON Schema 子集解释器）
//        ② schema 表达不了的语义校验：字段字典三层合并与 attrs、跨引用、坐标越界、
//           收藏条件可达、模块开关、来源与审校、禁用说法（健康功效 / 投资承诺）。
//  这是给 LLM 量产数据兜底的机器门：AI 产出先过它，再进顾问审校。
// ═══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(join(HERE, 'collectible.schema.json'), 'utf8'));
const CATS = JSON.parse(readFileSync(join(HERE, 'categories.json'), 'utf8'));
const ECON = JSON.parse(readFileSync(join(HERE, 'economy.json'), 'utf8'));
// 卡片规范版本：本校验器支持的 1.x 最高小版本。数据文件的小版本更高 = 用了本校验器不认识的新字段。
const SPEC = SCHEMA['x-specVersion'];
const SPEC_MINOR = Number(SPEC.split('.')[1]);

// 首期引擎已实现的模块；其余在 schema 里预留，出现即拒收。
const ENABLED_MODULES = new Set(['quiz']);
// 面向中老年用户的内容红线：不写健康功效，不做投资承诺。
const BANNED = /(降血压|降血糖|降血脂|降三高|抗癌|防癌|治病|治疗|包治|软化血管|延年益寿|壮阳|稳赚|必涨|保值增值|升值空间|投资回报|翻倍)/;

// ── ① JSON Schema 子集解释器 ─────────────────────────────────
function resolveRef(ref) {
  const path = ref.replace(/^#\//, '').split('/');
  let node = SCHEMA;
  for (const p of path) node = node[p];
  return node;
}

function typeOf(v) {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

function typeMatches(v, t) {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

function validate(v, s, path, errs) {
  if (s.$ref) return validate(v, resolveRef(s.$ref), path, errs);
  if (s.oneOf) {
    const ok = s.oneOf.filter((sub) => { const e = []; validate(v, sub, path, e); return e.length === 0; });
    if (ok.length !== 1) errs.push(`${path}: 不符合任一允许形态`);
    return;
  }
  if (s.const !== undefined && v !== s.const) { errs.push(`${path}: 必须为 ${JSON.stringify(s.const)}`); return; }
  if (s.enum && !s.enum.includes(v)) { errs.push(`${path}: 「${v}」不在闭集 ${JSON.stringify(s.enum)}`); return; }
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => typeMatches(v, t))) { errs.push(`${path}: 类型应为 ${types.join('|')}`); return; }
  }
  if (typeof v === 'string') {
    if (s.minLength !== undefined && [...v].length < s.minLength) errs.push(`${path}: 太短（≥${s.minLength} 字）`);
    if (s.maxLength !== undefined && [...v].length > s.maxLength) errs.push(`${path}: 太长（≤${s.maxLength} 字，现 ${[...v].length}）`);
    if (s.pattern && !new RegExp(s.pattern).test(v)) errs.push(`${path}: 「${v}」格式不符 ${s.pattern}`);
  }
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) errs.push(`${path}: 应 ≥ ${s.minimum}`);
    if (s.maximum !== undefined && v > s.maximum) errs.push(`${path}: 应 ≤ ${s.maximum}`);
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) errs.push(`${path}: 应 > ${s.exclusiveMinimum}`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) errs.push(`${path}: 至少 ${s.minItems} 项`);
    if (s.maxItems !== undefined && v.length > s.maxItems) errs.push(`${path}: 至多 ${s.maxItems} 项`);
    if (s.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) errs.push(`${path}: 有重复项`);
    if (s.items) v.forEach((x, i) => validate(x, s.items, `${path}[${i}]`, errs));
  }
  if (typeOf(v) === 'object') {
    for (const r of s.required || []) if (!(r in v)) errs.push(`${path}: 缺必填字段 ${r}`);
    for (const [k, x] of Object.entries(v)) {
      if (s.properties && s.properties[k]) validate(x, s.properties[k], `${path}.${k}`, errs);
      else if (s.additionalProperties === false) errs.push(`${path}: 未知字段 ${k}`);
      else if (s.additionalProperties && typeof s.additionalProperties === 'object') validate(x, s.additionalProperties, `${path}.${k}`, errs);
    }
  }
}

// ── ② 语义校验 ───────────────────────────────────────────────
function checkHobby(h, file, release) {
  const errs = [];
  const warns = [];
  validate(h, SCHEMA, h.id || file, errs);
  if (errs.length) return { errs, warns }; // 结构不对时不做语义层，免得连锁噪音

  const P = h.id;
  const fileMinor = Number(h.specVersion.split('.')[1]);
  if (fileMinor > SPEC_MINOR) errs.push(`${P}.specVersion: 文件是 ${h.specVersion}，本校验器只支持到 ${SPEC}，请先升级校验器`);
  const cat = CATS.categories[h.category];
  if (!cat) errs.push(`${P}.category: categories.json 里没有「${h.category}」`);
  else if (cat.proposed) warns.push(`${P}.category: 「${cat.name}」是待 owner 定的补充类`);

  // 模块开关
  const modules = new Set(h.modules || []);
  for (const m of modules) if (!ENABLED_MODULES.has(m)) errs.push(`${P}.modules: 模块「${m}」引擎尚未实现（首期只开 ${[...ENABLED_MODULES].join('/')}）`);

  // 称号阶梯
  h.titles.forEach((t, i) => {
    if (i === 0 && t.minXp !== 0) errs.push(`${P}.titles[0]: 第一档 minXp 必须为 0`);
    if (i > 0 && t.minXp <= h.titles[i - 1].minXp) errs.push(`${P}.titles[${i}]: minXp 须严格升序`);
  });

  // 字段字典三层合并：global → 大类 → 本爱好（不得重定义）
  const dict = new Map();
  const layers = [['global', CATS.global], [`大类 ${h.category}`, cat ? cat.fields : []], ['本爱好', h.fields || []]];
  for (const [layer, fields] of layers) {
    for (const f of fields) {
      if (dict.has(f.key)) errs.push(`${P}.fields: 「${f.key}」已在 ${dict.get(f.key).layer} 定义，${layer} 不得重定义`);
      else dict.set(f.key, { ...f, layer });
      if ((f.type === 'enum' || f.type === 'multi') && !(f.options && f.options.length >= 2)) errs.push(`${P}.fields.${f.key}: enum/multi 须给 ≥2 个 options`);
      if (f.ordered && f.type !== 'enum') errs.push(`${P}.fields.${f.key}: ordered 只能用在 enum 字段上`);
    }
  }

  // 雅钱：每档折合值须与品级一一对应、严格递增，最高档落在价位带区间内
  const vals = h.grading.values;
  if (vals.length !== h.grading.tiers.length) errs.push(`${P}.grading.values: 有 ${vals.length} 个值，但品级有 ${h.grading.tiers.length} 档，须一一对应`);
  vals.forEach((v, i) => { if (i > 0 && v <= vals[i - 1]) errs.push(`${P}.grading.values: 须严格递增（第 ${i + 1} 档 ${v} ≤ 前一档 ${vals[i - 1]}）`); });
  const band = CATS.priceBands.find((b) => b.id === h.market.priceBand);
  if (band) {
    const top = vals[vals.length - 1];
    const [lo, hi] = band.topValue;
    if (top < lo || top > hi) errs.push(`${P}.grading.values: 最高档 ${top} ${CATS.currency.name}不在价位带「${band.name}」的区间 ${lo}–${hi}`);
  }

  // 品相分级：维度必须是 ordered enum 字段
  const dims = [];
  for (const k of h.grading.dims) {
    const f = dict.get(k);
    if (!f) errs.push(`${P}.grading.dims: 「${k}」不在字段字典里`);
    else if (!(f.type === 'enum' && f.ordered)) errs.push(`${P}.grading.dims: 「${k}」须是 ordered: true 的 enum 字段（选项从低到高）`);
    else dims.push(f);
  }

  // 可养维度与保养品
  const careable = new Set();
  for (const f of dict.values()) {
    if (!f.careable) continue;
    if (!h.grading.dims.includes(f.key)) errs.push(`${P}.fields.${f.key}: careable 只能标在品相分级维度上`);
    else careable.add(f.key);
  }
  const careIds = new Set();
  for (const ci of h.careItems || []) {
    if (careIds.has(ci.id)) errs.push(`${P}.careItems: 「${ci.id}」重复`);
    careIds.add(ci.id);
    for (const d of ci.raises) if (!careable.has(d)) errs.push(`${P}.careItems.${ci.id}: raises「${d}」不是可养维度（先在字段上标 careable: true）`);
  }
  if (careable.size && !(h.careItems || []).length) warns.push(`${P}.careItems: 有可养维度但没有保养品，三消产不出东西`);

  // 行情板块
  let segField = null;
  if (h.market.segmentBy) {
    segField = dict.get(h.market.segmentBy);
    if (!segField || segField.type !== 'enum') { errs.push(`${P}.market.segmentBy: 「${h.market.segmentBy}」须是 enum 字段`); segField = null; }
    else if (h.grading.dims.includes(segField.key)) { errs.push(`${P}.market.segmentBy: 不能用品相维度细分（品级已经是板块的一层）`); segField = null; }
  }

  // 考级题库：每级抽 ECON.exam.questions 题
  const maxLevel = Math.max(...ECON.exam.levels.map((l) => l.requireTitleIndex));
  if (h.titles.length <= maxLevel) errs.push(`${P}.titles: 考级最高需要第 ${maxLevel + 1} 档称号，但只有 ${h.titles.length} 档`);

  // 领域知识库与门道模板
  const knowledge = new Map();
  for (const c of h.knowledge || []) {
    if (knowledge.has(c.id)) errs.push(`${P}.knowledge: 卡 id「${c.id}」重复`);
    knowledge.set(c.id, c);
  }
  const spotTypes = new Map();
  for (const t of h.spotTypes || []) {
    if (spotTypes.has(t.id)) errs.push(`${P}.spotTypes: 「${t.id}」重复`);
    spotTypes.set(t.id, t);
    if (!knowledge.has(t.cardId)) errs.push(`${P}.spotTypes.${t.id}: cardId「${t.cardId}」不在本爱好 knowledge 里`);
  }

  const usedCards = new Set();
  const itemIds = new Set(h.items.map((x) => x.id));
  const seenIds = new Set();
  const profiles = [];
  const imageKeys = new Set();

  for (const it of h.items) {
    const I = `${P}/${it.id}`;
    if (seenIds.has(it.id)) errs.push(`${I}: 藏品 id 重复`);
    seenIds.add(it.id);
    const origin = it.origin || 'official';

    if (it.care) errs.push(`${I}.care: 预留块，v1.0 不使用（养护走 careable 维度 + careItems）`);

    // attrs 按合并后的字典校验
    for (const [k, v] of Object.entries(it.attrs || {})) {
      const f = dict.get(k);
      if (!f) { errs.push(`${I}.attrs.${k}: 字段字典里没有这个 key（先在 fields 里声明）`); continue; }
      const bad = (msg) => errs.push(`${I}.attrs.${k}: ${msg}`);
      if (f.type === 'text' && typeof v !== 'string') bad('应为文本');
      if (f.type === 'bool' && typeof v !== 'boolean') bad('应为 true/false');
      if ((f.type === 'number' || f.type === 'year') && typeof v !== 'number') bad('应为数字');
      if (f.type === 'year' && !Number.isInteger(v)) bad('年份应为整数');
      if (typeof v === 'number' && f.min !== undefined && v < f.min) bad(`应 ≥ ${f.min}`);
      if (typeof v === 'number' && f.max !== undefined && v > f.max) bad(`应 ≤ ${f.max}`);
      if (f.type === 'enum' && !f.options.includes(v)) bad(`「${v}」不在选项 ${f.options.join('/')}`);
      if (f.type === 'multi' && !(Array.isArray(v) && v.every((x) => f.options.includes(x)))) bad(`应为选项 ${f.options.join('/')} 的子集`);
      if (f.type !== 'multi' && Array.isArray(v)) bad('不应为数组');
    }
    if (origin === 'official') {
      for (const f of dict.values()) if (f.required && !(it.attrs && f.key in it.attrs)) errs.push(`${I}.attrs: 缺必填字段 ${f.key}`);
    }

    // 品级：按品相维度规则计算，填写值必须与计算结果一致（养护后运行时同规则重算）
    if (it.tier !== undefined) {
      const ti = h.grading.tiers.indexOf(it.tier);
      if (ti < 0) errs.push(`${I}.tier: 「${it.tier}」不在品级 ${h.grading.tiers.join('/')}`);
      const missing = dims.filter((f) => !(it.attrs && f.key in it.attrs)).map((f) => f.key);
      if (missing.length) errs.push(`${I}.tier: 标了品级就要填全分级维度，缺 ${missing.join(', ')}`);
      else if (ti >= 0 && dims.length === h.grading.dims.length) {
        const expect = computeTier(dims, it.attrs, h.grading.tiers.length);
        if (expect !== ti) errs.push(`${I}.tier: 填「${it.tier}」，但按品相维度计算应为「${h.grading.tiers[expect]}」`);
      }
      if (segField && !(it.attrs && segField.key in it.attrs)) errs.push(`${I}.attrs: 行情按「${segField.key}」细分，须填写该字段`);
    } else if (origin === 'official') {
      warns.push(`${I}.tier: 未标品级（仅适用于看不出品级的藏品，如未开皮的青皮核桃）`);
    }

    // 图片
    const imgs = new Map();
    for (const im of it.images) {
      if (imageKeys.has(im.key)) errs.push(`${I}.images: key「${im.key}」与其他藏品重复（图与坐标绑定，禁止共用）`);
      imageKeys.add(im.key);
      imgs.set(im.key, im);
      if (im.source.license.startsWith('CC-BY') && !(im.source.credit && im.source.url)) errs.push(`${I}.images.${im.key}: CC-BY 系须署名并给来源 url`);
      if (origin === 'user' && im.source.license !== 'user-upload') errs.push(`${I}.images.${im.key}: 用户真藏的图 license 须为 user-upload`);
      const tbd = im.sha256 === 'TBD' || im.source.license === 'TBD';
      if (tbd) (release ? errs : warns).push(`${I}.images.${im.key}: 图片未定稿（sha256/授权为 TBD）`);
    }
    if (!it.images.some((im) => (im.role || 'main') === 'main')) errs.push(`${I}.images: 至少一张 role=main`);

    // 本件卡
    const itemCards = new Map();
    for (const c of it.cards || []) {
      if (itemCards.has(c.id) || knowledge.has(c.id)) errs.push(`${I}.cards: 卡 id「${c.id}」与本件或领域知识库重复`);
      itemCards.set(c.id, c);
      if (origin === 'user' && c.review.status !== 'owner-claim') errs.push(`${I}.cards.${c.id}: 用户真藏的卡 review.status 须为 owner-claim`);
      if (origin === 'official' && c.review.status === 'owner-claim') errs.push(`${I}.cards.${c.id}: 官方藏品不得用 owner-claim`);
    }

    // 门道点
    const spotIds = new Set();
    let keyCount = 0;
    for (const s of it.spots) {
      const S = `${I}.spots.${s.id}`;
      if (spotIds.has(s.id)) errs.push(`${S}: 门道点 id 重复`);
      spotIds.add(s.id);
      const tpl = s.type ? spotTypes.get(s.type) : null;
      if (s.type && !tpl) errs.push(`${S}: type「${s.type}」不在本爱好 spotTypes 里`);
      const cardId = s.cardId || (tpl && tpl.cardId);
      if (!cardId) errs.push(`${S}: 须写 type 或 cardId 之一`);
      else if (!itemCards.has(cardId) && !knowledge.has(cardId)) errs.push(`${S}: cardId「${cardId}」在本件 cards 与领域 knowledge 里都找不到`);
      else usedCards.add(cardId);
      const img = imgs.get(s.imageKey);
      if (!img) errs.push(`${S}: imageKey「${s.imageKey}」不是本件的图`);
      else {
        const { x, y, r } = s.shape;
        const ry = r * img.w / img.h; // r 相对宽度，折算到高度方向
        if (x - r < 0 || x + r > 1 || y - ry < 0 || y + ry > 1) errs.push(`${S}: 热区圆超出图片边界`);
      }
      if (s.closeupKey && !imgs.has(s.closeupKey)) errs.push(`${S}: closeupKey「${s.closeupKey}」不是本件的图`);
      if (s.key ?? (tpl && tpl.key) ?? false) keyCount++;
      if (s.flaw && cardId) {
        const card = itemCards.get(cardId) || knowledge.get(cardId);
        if (card && card.kind !== 'authenticity') warns.push(`${S}: 标了瑕疵，但知识卡类别不是 authenticity（鉴别）`);
      }
    }
    if (keyCount === 0) errs.push(`${I}.collect: 没有任何 key 门道点，收藏条件不可达`);
    if (typeof it.collect.keySpots === 'number' && it.collect.keySpots > keyCount) errs.push(`${I}.collect: 需要 ${it.collect.keySpots} 个 key 门道点，但只有 ${keyCount} 个`);

    for (const c of itemCards.values()) if (!usedCards.has(c.id)) warns.push(`${I}.cards.${c.id}: 没有门道点引用这张卡`);

    // 档案卡
    if (!it.profile) {
      if (origin === 'official') errs.push(`${I}.profile: 官方藏品必须有档案卡`);
    } else {
      profiles.push([I, it]);
    }
  }

  // 档案卡：按段落类型校验字段；对比与相关的引用须能对上号
  for (const [I, it] of profiles) {
    const pf = it.profile;
    const kinds = new Set();
    const texts = [pf.summary];
    pf.sections.forEach((sec, i) => {
      const S = `${I}.profile.sections[${i}](${sec.kind})`;
      kinds.add(sec.kind);
      texts.push(sec.title, sec.body || '');
      const need = (cond, msg) => { if (!cond) errs.push(`${S}: ${msg}`); };
      const refOk = (r) => (r.includes('/') ? true : itemIds.has(r) && r !== it.id);
      if (sec.kind === 'history') need(sec.body || sec.timeline, '来历须有 body 或 timeline');
      else if (sec.kind === 'compare') {
        need(sec.with && sec.points, '对比须有 with 与 points');
        if (sec.with && !refOk(sec.with)) errs.push(`${S}: 对比对象「${sec.with}」不是本爱好的另一件藏品`);
      } else if (sec.kind === 'related') {
        need(sec.refs, '相关须有 refs');
        for (const r of sec.refs || []) if (!refOk(r)) errs.push(`${S}: 相关「${r}」不是本爱好的另一件藏品`);
      } else need(sec.body, '须有 body');
      if (sec.kind !== 'compare' && sec.points) errs.push(`${S}: points 只用于 compare`);
      if (sec.kind !== 'history' && sec.timeline) errs.push(`${S}: timeline 只用于 history`);
      for (const t of sec.timeline || []) texts.push(t.text);
      for (const pt of sec.points || []) texts.push(pt.self, pt.other);
    });
    const hit = texts.join(' ').match(BANNED);
    if (hit) errs.push(`${I}.profile: 含禁用说法「${hit[0]}」（不写健康功效、不做投资承诺）`);
    if (pf.sections.length < 3) warns.push(`${I}.profile: 只有 ${pf.sections.length} 段，建议至少 3 段（来历 / 类比 / 对比 / 冷知识 / 挑法…）`);
    if (!kinds.has('history')) warns.push(`${I}.profile: 没有「来历」段`);
    const live = pf.review.status === 'reviewed' || pf.review.status === 'owner-claim';
    if (!live) (release ? errs : warns).push(`${I}.profile: 档案未审校（${pf.review.status}），不能上线`);
  }

  // 所有卡：模块、小考、禁用说法、审校
  const allCards = [...knowledge.values(), ...h.items.flatMap((it) => it.cards || [])];
  for (const c of allCards) {
    const C = `${P}.card.${c.id}`;
    if (c.quiz && !modules.has('quiz')) errs.push(`${C}: 带小考但 modules 未开 quiz`);
    if (c.quiz && c.quiz.answer >= c.quiz.options.length) errs.push(`${C}.quiz: answer 越界`);
    const text = [c.title, c.body, c.quiz && c.quiz.q, c.quiz && c.quiz.explain].filter(Boolean).join(' ');
    const hit = text.match(BANNED);
    if (hit) errs.push(`${C}: 含禁用说法「${hit[0]}」（不写健康功效、不做投资承诺）`);
    const live = c.review.status === 'reviewed' || c.review.status === 'owner-claim';
    if (usedCards.has(c.id) && !live) (release ? errs : warns).push(`${C}: 未审校（${c.review.status}），不能上线`);
  }
  for (const id of knowledge.keys()) if (!usedCards.has(id)) warns.push(`${P}.knowledge.${id}: 目前没有任何门道点用到`);
  const quizCount = allCards.filter((c) => c.quiz).length;
  if (quizCount < ECON.exam.questions) warns.push(`${P}: 考级题库只有 ${quizCount} 题，一级考试要抽 ${ECON.exam.questions} 题（量产时补足）`);

  return { errs, warns };
}

// 品级计算规则（与运行时一致）：各维度档位归一化到 0..1 取平均，乘 (品级数−1) 四舍五入。
function computeTier(dims, attrs, tierCount) {
  const mean = dims.reduce((a, f) => a + f.options.indexOf(attrs[f.key]) / (f.options.length - 1), 0) / dims.length;
  return Math.round(mean * (tierCount - 1));
}

// 行情板块全集：爱好/品级，或 爱好/细分字段值/品级
function segmentsOf(h) {
  const tiers = h.grading.tiers;
  const by = h.market.segmentBy;
  if (!by) return new Set(tiers.map((t) => `${h.id}/${t}`));
  const f = (h.fields || []).find((x) => x.key === by) || CATS.global.concat(CATS.categories[h.category]?.fields || []).find((x) => x.key === by);
  const out = new Set();
  for (const v of f ? f.options : []) for (const t of tiers) out.add(`${h.id}/${v}/${t}`);
  return out;
}

// ── 每日行情指数序列 ─────────────────────────────────────────
function checkIndex(idx, file) {
  const errs = [];
  const warns = [];
  const P = `${idx.hobby || file}.index`;
  if (idx.schema !== 'game113.index/1') { errs.push(`${P}: schema 须为 game113.index/1`); return { errs, warns }; }
  let hobby;
  try { hobby = JSON.parse(readFileSync(join(dirname(file), `${idx.hobby}.hobby.json`), 'utf8')); }
  catch { errs.push(`${P}: 找不到同目录的 ${idx.hobby}.hobby.json`); return { errs, warns }; }
  const segs = segmentsOf(hobby);
  const cap = ECON.market.dailyChangeCap;
  let prev = null;
  let prevDate = null;
  for (const [i, day] of (idx.series || []).entries()) {
    const D = `${P}.series[${i}](${day.date})`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) { errs.push(`${D}: date 须为 YYYY-MM-DD`); continue; }
    if (prevDate) {
      const gap = (Date.parse(day.date) - Date.parse(prevDate)) / 86400000;
      if (gap !== 1) errs.push(`${D}: 日期须逐日连续（与前一条相差 ${gap} 天）；缺数据的日子沿用前值写一条`);
    }
    for (const [seg, v] of Object.entries(day.values || {})) {
      if (!segs.has(seg)) errs.push(`${D}: 板块「${seg}」不存在`);
      if (!(typeof v === 'number' && v > 0)) errs.push(`${D}: 「${seg}」指数须为正数`);
      if (prev && prev[seg] !== undefined) {
        const ch = v / prev[seg] - 1;
        if (Math.abs(ch) > cap + 1e-9) errs.push(`${D}: 「${seg}」单日变动 ${(ch * 100).toFixed(1)}% 超过封顶 ±${cap * 100}%`);
      }
    }
    if (prev) for (const seg of Object.keys(prev)) if (!(seg in (day.values || {}))) errs.push(`${D}: 缺板块「${seg}」（没有新数据也要沿用前值）`);
    prev = day.values || {};
    prevDate = day.date;
  }
  return { errs, warns };
}

// ── CLI ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const release = args.includes('--release');
let files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  const dir = join(HERE, 'examples');
  files = readdirSync(dir).filter((f) => f.endsWith('.hobby.json') || f.endsWith('.index.json')).map((f) => join(dir, f));
}

let totalErr = 0;
for (const f of files) {
  let h;
  try { h = JSON.parse(readFileSync(f, 'utf8')); }
  catch (e) { console.error(`✗ ${f}: 不是合法 JSON（${e.message}）`); totalErr++; continue; }
  const isIndex = f.endsWith('.index.json');
  const { errs, warns } = isIndex ? checkIndex(h, f) : checkHobby(h, f, release);
  totalErr += errs.length;
  const what = isIndex ? `${(h.series || []).length} 天行情` : `${Array.isArray(h.items) ? h.items.length : 0} 件藏品`;
  console.log(`${errs.length ? '✗' : '✓'} ${f}  （${what} · ${errs.length} error · ${warns.length} warn）`);
  for (const e of errs) console.log(`   ERROR ${e}`);
  for (const w of warns) console.log(`   warn  ${w}`);
}
console.log(totalErr ? `\n共 ${totalErr} 个 error${release ? '（上线门）' : ''}` : `\n全部通过${release ? '上线门' : '（草稿门）'}`);
process.exit(totalErr ? 1 : 0);
