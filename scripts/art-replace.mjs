// scripts/art-replace.mjs —— 美术替换工作流大脑（REQ-DEMO-T1·工作流档 docs/design/art-replacement-workflow.md）。
// 两段式：placeholder 先行（art: 解析到免费库）→ 列表推导 → 配风格包 → 批量生成 → 对位替换。
// 全在服务/脚本层·src/assembly 引擎不动。apollo.py 薄胶水 shell 调本脚本；生成走 ai-gen.mjs 既有 adapters。
//
// 用法（apollo.py/smoke 调）：
//   node scripts/art-replace.mjs derive  <slug>            → 扫 manifest 推导台账 art-ledger.json（打印 JSON）
//   node scripts/art-replace.mjs batch   <slug> <packId> [--mock]  → 逐行生成 + 落盘 + 更新台账（打印 summary）
//   node scripts/art-replace.mjs replace <slug>            → 按编号重钉 manifest 引用（打印新 manifest·不落盘·apollo 校验后落）
//   node scripts/art-replace.mjs packs                     → 列风格包
// 纯函数（deriveLedger/applyReplacements/…）导出供单测直接跑（无需起服务）。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ADAPTERS, encodePng, curlFor } from './ai-gen.mjs';
import { STYLE_PACKS, listStylePacks } from './style-packs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART_PREFIX = 'art:';

// ── 路径 ──
const manifestFile = (root, slug) => {
  const lib = join(root, 'library', slug, 'manifest.json'); // 用户卡带优先
  if (existsSync(lib)) return lib;
  return join(root, 'public', 'games', slug, 'manifest.json'); // 内置纯数据游戏（tracked·owner 2026-07-10）
};
const ledgerFile = (root, slug) => join(root, 'public', 'games', slug, 'art', 'art-ledger.json');
const localIndexFile = (root, slug) => join(root, 'public', 'games', slug, 'art', 'index.json');
const genAbs = (root, slug, rel) => join(root, 'public', 'games', slug, 'art', rel);

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const readJson = (f, fb) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fb);
const writeJson = (f, o) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); };
const byIdCmp = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ═══ ① 列表推导器（工作流档 §三）：扫 manifest art: 槽位 → 台账行 ═══

const slotKey = (s) => [s.entity, s.component, s.field].join('\u0000');

function deriveKind(component, field, entity) {
  const f = field.toLowerCase(), c = component.toLowerCase(), e = entity.toLowerCase();
  if (component === 'Model3D' || f === 'modelkey' || f === 'meshkey') return 'model3d';
  if (f === 'clipid' || c.includes('sfx') || c.includes('sound')) return 'sfx';
  if (c.includes('music') || f === 'bgm') return 'music';
  if (/splash|title|logo|cover|opening/.test(e)) return 'splash';
  if (/background|backdrop|\bbg\b|^bg|sky|scene|floor/.test(e)) return 'bg';
  return 'sprite'; // Sprite.textureKey 等 2D 贴图默认（工作流档：主体视觉实体默认 Sprite+art:）
}

function deriveSpec(kind, comps) {
  if (kind === 'model3d') {
    const m = (comps && comps.Model3D) || {};
    return { polyBudget: 5000, scale: num(m.scale) ?? 1 };
  }
  if (kind === 'sfx' || kind === 'music') return { durationS: kind === 'music' ? 30 : 1 };
  // 2D：显示尺寸从 Shape/Transform 推
  const shape = (comps && comps.Shape) || {};
  const tf = (comps && comps.Transform) || {};
  const rad = num(shape.radius);
  let w = num(shape.width) ?? (rad != null ? rad * 2 : null);
  let h = num(shape.height) ?? (rad != null ? rad * 2 : null);
  if (kind === 'bg' || kind === 'splash') { w = w ?? 960; h = h ?? 540; }
  w = w ?? 64; h = h ?? 64;
  const sx = num(tf.scaleX) ?? 1, sy = num(tf.scaleY) ?? 1;
  return { w: Math.round(w), h: Math.round(h), displayW: Math.round(w * sx), displayH: Math.round(h * sy), transparent: kind !== 'bg' && kind !== 'splash' };
}

// 生成用详细描述（owner 07-09 review ①「图片描述没有很详细的信息」）：从组件数据推形体/颜色/
// 行为角色/画面占比/视角——英文（wanx/Tripo/Meshy 通吃），人可在台账改。row.prompt（手拼）仍最优先。
export function deriveDesc(comps, kind, name) {
  const c = comps || {};
  const hex = (t) => (typeof t === 'number' ? '#' + (t >>> 0).toString(16).padStart(6, '0').slice(-6) : null);
  const parts = [];
  // 形体（无 kind 时从字段推：radius→圆·width/height→矩形）
  const sh = c.Shape || {};
  const kindGuess = sh.kind ?? (num(sh.radius) != null ? 'circle' : (num(sh.width) != null || num(sh.height) != null) ? 'box' : null);
  if (kindGuess === 'circle') parts.push('round shape');
  else if (kindGuess === 'box') parts.push('rectangular shape');
  else if (kindGuess === 'polygon') {
    const n = Array.isArray(sh.vertices) ? sh.vertices.length / 2 : 0;
    parts.push(n === 6 ? 'hexagonal shape' : n === 4 ? 'diamond shape' : 'polygonal shape');
  }
  const col = hex(c.Color?.tint);
  if (col) parts.push(`main color ${col}`);
  // 行为角色（从 sim 组件推——这就是「游戏知道它是什么」）
  if (c.Perception) parts.push('defensive turret that senses and attacks enemies in range');
  else if (c.NavAgent) parts.push('moving enemy unit walking along a path');
  else if (c.Resource && c.Resource.id === 'lives') parts.push('home base structure to defend');
  else if (c.Clickable) parts.push('interactive build spot');
  if (c.Gauge) parts.push('with a status bar');
  // 画面占比 + 视角
  const spec = deriveSpec(kind, c);
  if (kind !== 'model3d' && spec.w != null) parts.push(spec.w >= 256 ? 'large on screen' : spec.w >= 64 ? 'medium size on screen' : `small on screen (${spec.w}x${spec.h})`);
  parts.push(kind === 'model3d' ? 'game-ready 3d model' : 'top-down 2d game view');
  if (spec.transparent) parts.push('isolated subject, transparent background');
  return `${name ? name + ', ' : ''}${parts.join(', ')}`;
}

function deriveContext(kind, entity, query, spec) {
  const area = (kind === 'bg' || kind === 'splash') ? '全屏' : ((spec.w ?? 0) >= 256 ? '画面占比大' : '画面占比小');
  const view = kind === 'model3d' ? '3D 模型' : '2D 平面';
  const trans = spec.transparent ? '需透明底' : '不透明满幅';
  return `用途=${kind}·实体「${entity}」·查询「${query}」·${view}·${area}·${trans}`;
}

/** manifest → 台账（= 替换列表·同一份文件两个视角）。纯函数·不改输入。编号按槽位标识确定性分配（重跑不漂移）。 */
export function deriveLedger(manifest, { game = '' } = {}) {
  const entities = (manifest && typeof manifest === 'object' && manifest.entities && typeof manifest.entities === 'object' && !Array.isArray(manifest.entities)) ? manifest.entities : {};
  const slots = [];
  for (const [eid, comps] of Object.entries(entities)) {
    if (!comps || typeof comps !== 'object' || Array.isArray(comps)) continue;
    for (const [cname, data] of Object.entries(comps)) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
      for (const [field, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.startsWith(ART_PREFIX)) {
          slots.push({ entity: eid, component: cname, field, query: value.slice(ART_PREFIX.length).trim(), comps });
        }
      }
    }
    // prefab 模板内的 art: 槽位（game-m 换装撞出的共性洞）：spawn 出来的实体也要有皮。
    // entity 路径='prefab:<宿主>:<模板>:<实体>'（与 resolveArtRefs/applyReplacements 同径）。
    const tpls = comps.PrefabLibrary && comps.PrefabLibrary.templates;
    if (tpls && typeof tpls === 'object') {
      for (const [tname, tpl] of Object.entries(tpls)) {
        const tents = tpl && tpl.entities;
        if (!tents || typeof tents !== 'object') continue;
        for (const [teid, tcomps] of Object.entries(tents)) {
          if (!tcomps || typeof tcomps !== 'object') continue;
          for (const [cname, data] of Object.entries(tcomps)) {
            if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
            for (const [field, value] of Object.entries(data)) {
              if (typeof value === 'string' && value.startsWith(ART_PREFIX)) {
                slots.push({ entity: `prefab:${eid}:${tname}:${teid}`, component: cname, field, query: value.slice(ART_PREFIX.length).trim(), comps: tcomps });
              }
            }
          }
        }
      }
    }
  }
  slots.sort((a, b) => slotKey(a).localeCompare(slotKey(b)));
  // 按素材去重（owner 07-12「100 个平台共用一张图却出 40 行」）：台账=美术需求表，一行=一种素材。
  // 同 (kind·组件·字段·query) 的槽位归并成一行——首槽位当代表（slot·编号身份不漂移），全量槽位记
  // slots[]（applyReplacements 据它扇出回写到每个实体）。不同 query/kind 仍各占一行。
  const groups = new Map();
  for (const s of slots) {
    const kind = deriveKind(s.component, s.field, s.entity);
    const key = [kind, s.component, s.field, s.query].join('|');
    if (!groups.has(key)) groups.set(key, { kind, first: s, members: [] });
    groups.get(key).members.push({ entity: s.entity, component: s.component, field: s.field });
  }
  const rows = [...groups.values()].map((g, i) => {
    const s = g.first;
    const spec = deriveSpec(g.kind, s.comps);
    const ctx = deriveContext(g.kind, s.entity, s.query, spec)
      + (g.members.length > 1 ? `·共 ${g.members.length} 处槽位共用` : '');
    return {
      no: 'art-' + String(i + 1).padStart(2, '0'),
      kind: g.kind, slot: g.members[0], slots: g.members, query: s.query,
      placeholder: { ref: ART_PREFIX + s.query, source: 'freelib' },
      spec, desc: deriveDesc(s.comps, g.kind, s.query), context: ctx,
      status: 'placeholder', gen: null, provenance: null,
    };
  });
  return { version: 1, game, rows };
}

// ═══ 需求推导（retrofit 路径·色块游戏没有 art: 槽位时）：扫所有视觉实体 → 该配什么美术 + 描述 ═══
// game-q 这类「零真资产·全程序化色块」的反面教材，用它产出「资产需求表」——每条=一个视觉实体
// 需要的美术 + 当前占位描述 + 美术需求描述。产出同台账 schema（status='needs-art'）。

const LOGIC_ONLY = new Set(['Resource', 'Flag', 'Timer', 'NavGraph', 'GameFlow', 'CraftRecipe', 'KeyBinding', 'PrefabLibrary', 'OverTime', 'GroupCount', 'Camera', 'Sensor', 'Hitbox', 'Tag', 'Relation', 'Perception', 'SelfRule', 'Caster', 'Aggro', 'Gauge', 'Clickable', 'Spawner', 'SpawnTicket']);

function humanize(id) {
  return String(id).replace(/^prefab:/, '').replace(/[:_/-]+/g, ' ').replace(/\b\w/g, (c) => c).trim();
}
function currentPlaceholderDesc(comps) {
  const hex = (t) => (typeof t === 'number' ? '#' + (t >>> 0).toString(16).padStart(6, '0').slice(-6) : '');
  // 皮肤槽（Sprite+Shape 并存）：Sprite=待填的皮·Shape=现回退观感（chooseRenderMode 未就绪时画 Shape）。
  if (comps.Sprite && typeof comps.Sprite.textureKey === 'string' && comps.Shape) {
    const s = comps.Shape; const c = comps.Color?.tint;
    return `皮肤槽 ${comps.Sprite.textureKey}（未填时回退 2D 色块 ${s.kind || 'shape'}${c != null ? '·' + hex(c) : ''}）`;
  }
  if (comps.Sprite && typeof comps.Sprite.textureKey === 'string') return `贴图 ${comps.Sprite.textureKey}`;
  if (comps.Model3D) return `3D 模型 ${comps.Model3D.modelKey || ''}`;
  if (comps.Mesh3D) { const m = comps.Mesh3D; const c = comps.Color?.tint ?? m.frontTint; return `程序化 3D 图元（${m.shape || 'mesh'}${c != null ? '·' + hex(c) : ''}${comps.Material3D?.emissive != null ? '·自发光' : ''}）`; }
  if (comps.Shape) { const s = comps.Shape; const c = comps.Color?.tint; return `2D 色块（${s.kind || 'shape'}${c != null ? '·' + hex(c) : ''}）`; }
  return '（无视觉·纯逻辑）';
}
function requirementKind(comps) {
  if (comps.Model3D || comps.Mesh3D) return 'model3d';
  if (comps.Sprite) return 'sprite';
  if (comps.Shape && comps.Color) return 'sprite'; // 2D 色块 → 需 2D 精灵皮
  return null; // 非视觉
}
function isVisual(comps) {
  if (comps.Visibility && comps.Visibility.visible === false) return false; // 隐形碰撞体不算
  return requirementKind(comps) != null;
}

/** 展平 entities（含 PrefabLibrary 模板里的实体）→ [{path, comps}]。 */
function flattenEntities(entities) {
  const out = [];
  for (const [eid, comps] of Object.entries(entities || {})) {
    if (!comps || typeof comps !== 'object') continue;
    out.push({ path: eid, comps });
    const tpls = comps.PrefabLibrary && comps.PrefabLibrary.templates;
    if (tpls && typeof tpls === 'object') {
      for (const [tname, tpl] of Object.entries(tpls)) {
        const tents = tpl && tpl.entities;
        if (tents && typeof tents === 'object') for (const [teid, tcomps] of Object.entries(tents)) out.push({ path: `prefab:${tname}:${teid}`, comps: tcomps });
      }
    }
  }
  return out;
}

// 视觉签名：结构等价（同类型/形状/色/发光）的实体归一条需求（如 8 个落点盘=一套盘美术）。
function visualSig(comps) {
  const m = comps.Mesh3D || {}; const s = comps.Shape || {};
  const tint = comps.Color?.tint ?? m.frontTint ?? '';
  return `${requirementKind(comps)}|${m.shape || s.kind || ''}|${tint}|${comps.Material3D?.emissive != null ? 'e' : ''}`;
}

/** 需求表：扫所有视觉实体（含预制模板）→ 归并结构等价实例 → 每条=需要的美术 + 当前占位 + 美术需求描述 + 实例数。 */
export function deriveRequirements(manifest, { game = '' } = {}) {
  const nodes = flattenEntities(manifest && manifest.entities).filter((n) => isVisual(n.comps));
  const groups = new Map(); // 归一键 = 去数字名 + 视觉签名
  for (const n of nodes) {
    const key = n.path.replace(/\d+/g, '#') + '|' + visualSig(n.comps);
    if (!groups.has(key)) groups.set(key, { rep: n, count: 0, instances: [] });
    const g = groups.get(key); g.count++; if (g.instances.length < 8) g.instances.push(n.path);
  }
  const arr = [...groups.values()].sort((a, b) => a.rep.path.localeCompare(b.rep.path));
  const rows = arr.map((g, i) => {
    const n = g.rep, kind = requirementKind(n.comps), spec = deriveSpec(kind, n.comps);
    const name = humanize(n.path.replace(/\d+/g, '')).replace(/\s+/g, ' ').trim();
    const cur = currentPlaceholderDesc(n.comps);
    const isTpl = n.path.startsWith('prefab:');
    const role = isTpl ? '预制模板（生成的每个实例共用一套美术）' : '场景实体';
    const view = kind === 'model3d' ? '3D（现程序化图元·可换真模型或 2D 精灵皮）' : '2D 平面';
    const times = g.count > 1 ? `×${g.count} 实例` : '单例';
    // 皮肤槽 key：实体已带 Sprite.textureKey（非 art: 前缀）→ 生成物按此 id 登记本地 index 即上画面（写回=登记别名）。
    const skin = (n.comps.Sprite && typeof n.comps.Sprite.textureKey === 'string' && !n.comps.Sprite.textureKey.startsWith(ART_PREFIX)) ? n.comps.Sprite.textureKey : null;
    return {
      ...(skin ? { skinKey: skin } : {}),
      no: 'art-' + String(i + 1).padStart(2, '0'),
      desc: deriveDesc(n.comps, kind, name.toLowerCase()),
      kind,
      slot: { entity: n.path, component: n.comps.Sprite ? 'Sprite' : (n.comps.Model3D ? 'Model3D' : (n.comps.Mesh3D ? 'Mesh3D' : 'Shape')), field: n.comps.Sprite ? 'textureKey' : (n.comps.Model3D ? 'modelKey' : 'art') },
      query: name.toLowerCase(),
      placeholder: { current: cur, source: 'procedural', count: g.count, instances: g.instances },
      spec,
      context: `美术需求：「${name}」（${role}·${times}）·${view}·当前占位=${cur}·${spec.transparent === false ? '不透明满幅' : '需透明底'}`,
      status: 'needs-art', gen: null, provenance: null,
    };
  });
  return { version: 1, game, mode: 'requirements', count: rows.length, instances: nodes.length, rows };
}

// ═══ 编号 append-only（owner 07-09「ID 错位」定案·工作流档 §三「重跑不漂移·只追加不重排」）═══
// 身份键：requirements 模式=slot.entity（组件升级 Shape→Sprite 不换号）；manifest 模式=槽位三元组。

const rowIdentity = (row, mode) => (mode === 'requirements' ? row.slot.entity : slotKey(row.slot));
const noNum = (no) => parseInt(String(no).replace(/^art-/, ''), 10) || 0;

/** 把 fresh 推导并进 prev 台账：已有身份**保原 no**、保状态/生成/provenance/prompt/history，只刷新推导字段；
 *  新身份取 max+1 顺延；消失的身份留墓碑 `status:'retired'`（保号·编号永不复用）。 */
/** slot 路径是否仍存在于 manifest（不管值是不是 art: 引用）。区分「实体真被删」与「引用已钉死/待真图」。 */
function slotExists(m, slot) {
  if (!m || !slot) return false;
  const { entity, component, field } = slot;
  let comp = null;
  if (String(entity).startsWith('prefab:')) {
    const [, owner, tname, teid] = String(entity).split(':');
    comp = m.entities?.[owner]?.PrefabLibrary?.templates?.[tname]?.entities?.[teid]?.[component];
  } else {
    comp = m.entities?.[entity]?.[component];
  }
  return !!(comp && typeof comp === 'object' && !Array.isArray(comp) && field in comp);
}

export function mergeLedger(prev, fresh, manifest = null) {
  if (!prev || !Array.isArray(prev.rows) || prev.rows.length === 0) return fresh;
  const mode = fresh.mode || prev.mode || '';
  const prevByKey = new Map(prev.rows.map((r) => [rowIdentity(r, mode), r]));
  let maxNo = Math.max(0, ...prev.rows.map((r) => noNum(r.no)));
  const seen = new Set();
  const rows = [];
  for (const f of fresh.rows) {
    const key = rowIdentity(f, mode);
    seen.add(key);
    const p = prevByKey.get(key);
    if (p) {
      // 人为改过 query（regen 留了 history）→ 人改的赢；否则以最新推导为准。
      const edited = Array.isArray(p.history) && p.history.some((h) => h.action === 'regen' && h.newQuery && h.newQuery !== h.prevQuery);
      rows.push({
        ...f, no: p.no, query: edited ? p.query : f.query,
        ...(p.prompt ? { prompt: p.prompt } : {}),
        status: p.status === 'retired' ? f.status : p.status,
        gen: p.gen ?? null, provenance: p.provenance ?? null,
        ...(p.history ? { history: p.history } : {}),
      });
    } else {
      maxNo += 1;
      rows.push({ ...f, no: 'art-' + String(maxNo).padStart(2, '0') });
    }
  }
  // 去重吸收（07-12「40 行该是 5 行」）：fresh 行现在背 slots[]——它已覆盖的槽位集合。
  const covered = new Set();
  for (const f of fresh.rows) for (const s of (Array.isArray(f.slots) ? f.slots : [f.slot])) covered.add(slotKey(s));
  for (const p of prev.rows) {
    if (seen.has(rowIdentity(p, mode))) continue;
    // 已钉死的槽位（replaced/filled/approved）从 fresh 消失是**正常态**——art: 引用已被替换成真资产 id，
    // 推导自然扫不到；保留原行原状态。只有未完成行（placeholder/needs-art/generated）消失才是真墓碑。
    if (['replaced', 'filled', 'approved'].includes(p.status)) { rows.push({ ...p }); continue; }
    // 被去重行吸收的旧重复行（同素材另一槽位·零资产零人工投入）→ 直接删（不留墓碑：需求没消失，
    // 只是并进了代表行；留墓碑反而把台账又撑回 40 行）。有人工痕迹（history）的不吸收，保留待人裁。
    if (p.status in { placeholder: 1, 'needs-art': 1 } && covered.has(slotKey(p.slot)) && !(Array.isArray(p.history) && p.history.length)) continue;
    // slot 仍在 manifest（引用只是非 art:——已钉死等真图/mock regen 中）→ 不是真消失，保留原行
    // （REQ-WORKSHOP C1 回归：PUT 即自动 derive 后，误墓碑会吃掉 mock regen 的 generated 行）。
    if (manifest && slotExists(manifest, p.slot)) { rows.push({ ...p }); continue; }
    rows.push({ ...p, status: 'retired' });
  }
  rows.sort((a, b) => noNum(a.no) - noNum(b.no));
  const artStyle = prev.artStyle ?? fresh.artStyle;
  return { ...fresh, ...(artStyle ? { artStyle } : {}), ...(fresh.count != null ? { count: rows.length } : {}), rows };
}

// ═══ ③④ 风格方言 + 缓存 + 后处理（工作流档 §四·§二④）═══

export function dialectPrompt(row, pack, gameStyle = '') {
  const provider = pack.params.provider;
  const zh = provider === 'qwen' || provider === 'seedream'; // 中文文生图（万相/Seedream 均吃中文 promptZh）
  const base = zh ? pack.promptZh : pack.promptEn;
  const kindWord = zh
    ? ({ sprite: '精灵图', texture: '贴图', bg: '背景图', splash: '启动画', model3d: '3D 模型' }[row.kind] || '图')
    : ({ sprite: 'game sprite', texture: 'texture', bg: 'background', splash: 'splash screen', model3d: '3d model' }[row.kind] || 'image');
  // 主体优先级：row.prompt（人工精调·整体替代）> query+desc（机器推导详细描述）> query。
  const subject = (typeof row.prompt === 'string' && row.prompt.trim())
    ? row.prompt.trim()
    : [row.query || '', row.desc || ''].filter(Boolean).join(', ');
  // gameStyle = 每游戏整体风格锚（台账头 artStyle.stylePrompt·owner 07-09 review ②），拼在风格包之后。
  const styleTail = (typeof gameStyle === 'string' && gameStyle.trim()) ? `, ${gameStyle.trim()}` : '';
  return `${subject}, ${kindWord}, ${base}${styleTail}`.trim();
}

/** 内容寻址缓存键 = hash(provider + prompt + model + seed)。命中 → 不重扣费（断点续跑）。 */
export function cacheKey(provider, prompt, params) {
  return createHash('sha256').update(JSON.stringify({ provider, prompt, model: params.model, seed: params.seed ?? null })).digest('hex').slice(0, 16);
}

const hexRgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
/** palette-snap：每像素量化到风格包调色板最近色（同批共用一板 → 天然成套）。原地改·返回同 buffer。 */
export function paletteSnapRgb(rgb, palette) {
  const pal = palette.map(hexRgb);
  for (let o = 0; o < rgb.length; o += 3) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < pal.length; k++) {
      const dr = rgb[o] - pal[k][0], dg = rgb[o + 1] - pal[k][1], db = rgb[o + 2] - pal[k][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = k; }
    }
    rgb[o] = pal[best][0]; rgb[o + 1] = pal[best][1]; rgb[o + 2] = pal[best][2];
  }
  return rgb;
}

// prompt 播种的确定性噪声（mock·同 prompt→同图）；pixelGrid 给出=按格块化。
function mockRawRgb(prompt, w, h, pixelGrid) {
  let seed = 2166136261; for (let i = 0; i < prompt.length; i++) { seed ^= prompt.charCodeAt(i); seed = (seed * 16777619) >>> 0; }
  const H = (x, y) => { let hh = ((x * 374761393) ^ (y * 668265263) ^ seed) >>> 0; hh = ((hh ^ (hh >>> 13)) * 1274126177) >>> 0; return ((hh ^ (hh >>> 16)) >>> 0) / 4294967296; };
  const block = pixelGrid ? Math.max(1, Math.floor(w / pixelGrid)) : 8;
  const rgb = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = H(Math.floor(x / block), Math.floor(y / block)) * 0.7 + H(x, y) * 0.3, o = (y * w + x) * 3;
    rgb[o] = 40 + v * 180; rgb[o + 1] = 40 + H(y, x) * 180; rgb[o + 2] = 60 + v * 150;
  }
  return rgb;
}

const LICENSE = { qwen: 'Qwen/DashScope 万相 (按订阅授权)', seedream: 'ByteDance Seedream/火山方舟 (按订阅商用授权)', tripo: 'Tripo (按订阅商用授权)', meshy: 'Meshy (按订阅商用授权)' };
const ENVKEY = { qwen: 'DASHSCOPE_API_KEY', seedream: 'ARK_API_KEY', tripo: 'TRIPO_API_KEY', meshy: 'MESHY_API_KEY' };
const TWO_D_PROVIDERS = ['qwen', 'seedream']; // 2D 文生图生成器闭集（owner 2026-07-21 加 seedream·字节火山方舟）
// provider 选择：默认=风格包钉死（一致性层2）；override=平台菜单点名覆盖（owner 07-09 review ④）——
// 3D 行只认 tripo/meshy，2D 行认 qwen/seedream；不兼容的覆盖忽略回默认（2D 默认回退 qwen）。
const provFor = (row, pack, override = null) => {
  if (row.kind === 'model3d') {
    if (override && ['tripo', 'meshy'].includes(override)) return override;
    return ['tripo', 'meshy'].includes(pack.params.provider) ? pack.params.provider : 'meshy';
  }
  if (override && TWO_D_PROVIDERS.includes(override)) return override;
  return TWO_D_PROVIDERS.includes(pack.params.provider) ? pack.params.provider : 'qwen';
};

/**
 * 目标生成尺寸（按行 spec 推·防 UI 元素被塞进 2K 方图渲成整场景）：
 * - bg/splash（全屏）→ null（用 adapter 默认大图·2K）；
 * - UI/sprite/texture 有 spec w×h → 保长宽比、长边归一 ~1024、各边夹 [512,2048]、8 的倍数 → `WxH`；
 * - 无 spec → null（不强加·用默认）。
 * 导出供单测 + debug 回显。
 */
export function sizeForSpec(row) {
  if (row.kind === 'bg' || row.kind === 'splash' || row.kind === 'model3d') return null;
  const w = row.spec?.w, h = row.spec?.h;
  if (typeof w !== 'number' || typeof h !== 'number' || w <= 0 || h <= 0) return null;
  const k = 1024 / Math.max(w, h);
  const clamp = (n) => Math.min(2048, Math.max(512, Math.round((n * k) / 8) * 8));
  return `${clamp(w)}x${clamp(h)}`;
}

/** 单行产资产（2D：mock→palette-snap+按 spec 尺寸·真调→adapter；3D：tripo/meshy adapter）。返回含 request（供 debug 回显·mock 也带）。 */
export async function genRowAsset(row, pack, { mock = true, apiKey = null, gameStyle = '', provider: providerOverride = null } = {}) {
  const provider = provFor(row, pack, providerOverride);
  const prompt = dialectPrompt(row, pack, gameStyle);
  const ck = cacheKey(provider, prompt, pack.params);
  const size = sizeForSpec(row);
  if (row.kind === 'model3d') {
    const g = await ADAPTERS[provider].generate(prompt, { mock, apiKey });
    return { buffer: g.buffer, ext: 'glb', provider, model: g.model, mock: !!g.mock, prompt, cacheKey: ck, request: g.request ?? null };
  }
  if (mock || !apiKey) {
    // mock 也向 adapter 要一次「本该发的请求」用于 debug 回显（不产真图·免花 key）；像素仍走确定性 mock+palette-snap。
    const w = row.spec?.w ?? 64, h = row.spec?.h ?? 64;
    let request = null;
    try { request = (await ADAPTERS[provider].generate(prompt, { mock: true, apiKey: null, size }))?.request ?? null; } catch { /* adapter 无 request=旧适配器·忽略 */ }
    const rgb = mockRawRgb(prompt, w, h, pack.post.pixelGrid); // 生成
    if (pack.post.paletteSnap) paletteSnapRgb(rgb, pack.palette); // ④ 后处理（mock 同走）
    return { buffer: encodePng(w, h, rgb), ext: 'png', provider, model: pack.params.model + '·mock', mock: true, prompt, cacheKey: ck, request };
  }
  const g = await ADAPTERS[provider].generate(prompt, { mock: false, apiKey, size }); // 真调（palette-snap on real=冲刺后精修）
  return { buffer: g.buffer, ext: 'png', provider, model: g.model, mock: false, prompt, cacheKey: ck, request: g.request ?? null };
}

// ═══ ④ 批量生成器（并发留给 apollo 层·此处确定性顺序·缓存/续跑/探针）═══

/** 逐行生成落盘 + 登记游戏本地 index + 更新台账。断点续跑=命中缓存(cacheKey+文件在)不重扣费；无 key=探针+mock。 */
export async function batchGenerate(ledger, packId, { root = ROOT, game, mock = true, env = process.env, at = new Date().toISOString(), only = null, provider: providerOverride = null, allowMock = false, debug = false } = {}) {
  const pack = STYLE_PACKS[packId];
  if (!pack) return { ok: false, error: `未知风格包: ${packId}` };
  if (!game) return { ok: false, error: 'batchGenerate 需要 game' };
  const idxFile = localIndexFile(root, game);
  const index = readJson(idxFile, { version: 1, assets: [] });
  if (!Array.isArray(index.assets)) index.assets = [];
  const byId = new Map(index.assets.map((a) => [a.id, a]));
  // debug：每行回显「实际发给文生图的完整提示词 + 完整请求（含 curl 命令行·key 打码）」——owner 2026-07-22
  // 「知道我到底传了什么」。mock 也带（genRowAsset 向 adapter 要 request）→ 免花 key 就能核对。
  const summary = { total: 0, generated: 0, cached: 0, mock: 0, failed: 0, skipped: 0, probes: [], errors: [], debug: [] };
  const gameStyle = (ledger.artStyle && typeof ledger.artStyle.stylePrompt === 'string') ? ledger.artStyle.stylePrompt : '';
  for (const row of ledger.rows) {
    if (only && row.no !== only) { summary.skipped++; continue; } // 单槽点名（fill/regen）
    if (row.status === 'retired') { summary.skipped++; continue; } // 墓碑行（编号保留·槽位已消失）
    if (['sfx', 'music', 'particle'].includes(row.kind)) { summary.skipped++; continue; } // 冲刺期只登记不生成
    summary.total++;
    const provider = provFor(row, pack, providerOverride);
    const ext = row.kind === 'model3d' ? 'glb' : 'png';
    const apiKey = env[ENVKEY[provider]] || null;
    if (!mock && !apiKey) summary.probes.push({ no: row.no, provider, envKey: ENVKEY[provider], configured: false, note: '未配 key → mock 占位（绝不静默顶替）' });
    const useMock = mock || !apiKey;
    // mock 产物独立命名空间 gen/mock/*（owner 2026-07-10「Mock 数据不该这样做」）：mock 的文件路径与
    // index id 绝不与真图 gen/art-NN 同名——否则已钉死真图的游戏一跑 mock 批就被覆盖上画面（后门泄漏）。
    const outRel = useMock ? `gen/mock/${row.no}.${ext}` : `gen/${row.no}.${ext}`;
    const outAbs = genAbs(root, game, outRel);
    const ck = cacheKey(provider, dialectPrompt(row, pack, gameStyle), pack.params);
    if (['generated', 'replaced'].includes(row.status) && row.gen?.cacheKey === ck && existsSync(outAbs)) { summary.cached++; continue; } // 命中·不重扣费
    // 首次覆盖前存原始态快照（供「一键还原」·对齐上传路径 handle_art_upload·owner 2026-07-21 报「还原变色块」修）：
    // 之前 orig 只在上传路径存·AI 生成不存 → 生成后还原找不到快照走 fallback=色块。此处补齐 → 还原精确复位。
    if (!('orig' in row)) {
      const skinEntry = row.skinKey ? byId.get(row.skinKey) : null;
      row.orig = { status: row.status ?? null, gen: row.gen ?? null, indexEntry: skinEntry ? JSON.parse(JSON.stringify(skinEntry)) : null };
    }
    let a;
    try { a = await genRowAsset(row, pack, { mock: useMock, apiKey, gameStyle, provider: providerOverride }); }
    catch (e) { row.status = 'failed'; row.gen = { provider, error: String(e).slice(0, 200) }; summary.failed++; summary.errors.push({ no: row.no, provider, error: String(e).slice(0, 200) }); continue; }
    // debug 回显：实际（或本该）发给文生图的完整提示词 + 请求 + curl 命令行（key 打码·mock 也有）。
    const dbg = { no: row.no, provider: a.provider, model: a.model, kind: row.kind, mock: !!a.mock, prompt: a.prompt, size: a.request?.size ?? null, endpoint: a.request?.endpoint ?? null, body: a.request?.body ?? null, curl: a.request ? curlFor(a.request, ENVKEY[a.provider]) : null };
    summary.debug.push(dbg);
    if (debug) {
      console.log(`\n[GEN·${a.provider}] ${row.no}${a.mock ? '·mock' : ''} kind=${row.kind} size=${dbg.size ?? '(默认)'}`);
      console.log(`  prompt: ${a.prompt}`);
      if (dbg.curl) console.log(`  ${dbg.curl}`);
    }
    mkdirSync(dirname(outAbs), { recursive: true }); writeFileSync(outAbs, a.buffer);
    const id = useMock ? `gen/mock/${row.no}` : `gen/${row.no}`;
    const servedPath = `/games/${game}/art/${outRel}`;
    const entry = {
      id, type: row.kind === 'model3d' ? 'mesh' : 'texture', description: `${row.query} · 生成(${packId}${a.mock ? '·mock' : ''})`,
      status: 'filled', path: servedPath, category: row.kind === 'model3d' ? 'mesh' : 'ai-gen',
      tags: ['gen', packId, row.kind, ...(a.mock ? ['mock'] : [])], license: LICENSE[a.provider], source: `gen:${a.provider}`,
      provenance: { generator: a.provider, prompt: a.prompt, model: a.model, mock: a.mock, generatedAt: at, pack: packId, style: pack.name, vendoredFrom: null },
    };
    byId.set(id, entry);
    // 写回=登记别名（编译期游戏线）：行带 skinKey → 同产物再登记一条 id=skinKey；游戏 mount 时按
    // skinKey resolve → chooseRenderMode 贴图就绪即盖过 Shape 上画面。蓝图零改动（工作流档 §二⑤）。
    // mock 不上画面（owner 2026-07-10「Mock 数据不该这样做」）：皮肤别名只在真图时登记——
    // 真图前游戏保持原始观感（Shape 回退/freelib placeholder）。mock 产物仅供平台墙预览。
    if (row.skinKey && (!a.mock || allowMock)) byId.set(row.skinKey, { ...entry, id: row.skinKey, description: `${row.query} · 皮肤槽(${row.skinKey})`, tags: [...entry.tags, 'skin'] });
    row.status = 'generated';
    row.gen = { provider: a.provider, model: a.model, prompt: a.prompt, cacheKey: ck, pack: packId, servedPath, localId: id, mock: !!a.mock };
    row.provenance = { model: a.model, prompt: a.prompt, date: at, license: LICENSE[a.provider] }; // M2.5 口径硬字段
    summary.generated++; if (a.mock) summary.mock++;
  }
  index.assets = [...byId.values()].sort(byIdCmp);
  writeJson(idxFile, index);
  return { ok: true, ledger, summary };
}

// ═══ ⑤ 对位替换（按编号重钉 manifest 引用·工作流档 §二⑤）═══

/** 把 generated 行的 manifest 落点从 art: 串重钉为生成资产的本地 id；status→replaced。纯函数·不改输入 manifest。 */
export function applyReplacements(manifest, ledger, { allowMock = false } = {}) {
  const m = JSON.parse(JSON.stringify(manifest));
  let replaced = 0;
  let skippedMock = 0;
  for (const row of ledger.rows) {
    if (row.status !== 'generated' || !row.gen?.localId) continue;
    if (row.gen.mock && !allowMock) { skippedMock++; continue; } // mock 永不写回（真图前保持原始 placeholder 观感）
    // 去重台账：一行可背多个槽位（slots[]·07-12），逐槽位扇出回写；旧单槽行照旧走 row.slot。
    const targets = Array.isArray(row.slots) && row.slots.length ? row.slots : [row.slot];
    let hit = 0;
    for (const { entity, component, field } of targets) {
      let comp = null;
      if (entity.startsWith('prefab:')) {
        // 嵌套寻径：prefab:<宿主>:<模板>:<实体> → entities[宿主].PrefabLibrary.templates[模板].entities[实体]
        const [, owner, tname, teid] = entity.split(':');
        comp = m.entities?.[owner]?.PrefabLibrary?.templates?.[tname]?.entities?.[teid]?.[component];
      } else {
        comp = m.entities && m.entities[entity] && m.entities[entity][component];
      }
      if (comp && typeof comp === 'object' && !Array.isArray(comp)) { comp[field] = row.gen.localId; hit++; }
    }
    if (hit > 0) { row.status = 'replaced'; replaced += hit; }
  }
  return { manifest: m, ledger, replaced, skippedMock };
}

// ═══ T2 ① 单槽重解析（换皮/点名优化共用地基）+ ④ 三式替换 ═══

function pushHistory(row, entry) { if (!Array.isArray(row.history)) row.history = []; row.history.push(entry); }

/** 单行打回待生成（点名「重新生成」·可改 query/prompt）。批处理会据 status 只重跑它、其余命中缓存不动。 */
export function resetRow(ledger, no, { query, at = new Date().toISOString() } = {}) {
  const row = ledger.rows.find((r) => r.no === no);
  if (!row) return { ok: false, error: `无此编号: ${no}` };
  pushHistory(row, { action: 'regen', at, prevQuery: row.query, newQuery: (typeof query === 'string' && query.trim()) ? query.trim() : row.query });
  if (typeof query === 'string' && query.trim()) row.query = query.trim();
  row.status = 'placeholder'; row.gen = null; row.provenance = null;
  return { ok: true, row };
}

/** 换全部行（换皮用·同一列表整批重跑）。 */
export function resetAllRows(ledger, at = new Date().toISOString()) {
  for (const r of ledger.rows) {
    if (r.status === 'retired') continue; // 墓碑行保号不参与换皮
    pushHistory(r, { action: 'reskin-reset', at, prevQuery: r.query }); r.status = 'placeholder'; r.gen = null; r.provenance = null;
  }
  return ledger;
}

/** 点名「从共享库选换 / 上传替换」：把某槽 manifest 引用直接钉到一个已存在资产 id（不重新生成·台账留历史）。 */
export function swapSlot(manifest, ledger, no, assetId, { source = 'library', at = new Date().toISOString() } = {}) {
  const row = ledger.rows.find((r) => r.no === no);
  if (!row) return { ok: false, error: `无此编号: ${no}` };
  if (typeof assetId !== 'string' || !assetId.trim()) return { ok: false, error: 'assetId 不能为空' };
  const m = JSON.parse(JSON.stringify(manifest));
  const { entity, component, field } = row.slot;
  const comp = m.entities && m.entities[entity] && m.entities[entity][component];
  if (!comp || typeof comp !== 'object' || Array.isArray(comp)) return { ok: false, error: `槽位落点不存在: ${entity}.${component}` };
  comp[field] = assetId.trim();
  pushHistory(row, { action: source === 'upload' ? 'upload' : 'swap-library', at, assetId: assetId.trim() });
  row.status = 'replaced';
  row.gen = { source, localId: assetId.trim() };
  row.provenance = { model: source, prompt: row.query, date: at, license: source === 'upload' ? '用户上传' : '共享库' };
  return { ok: true, manifest: m, row };
}

// ═══ CLI（apollo.py/smoke 薄胶水调用）═══

// 台账推导（美术库地基）：优先 deriveLedger（扫 art: 皮肤槽）；纯色块生成游戏无 art: 槽 → 会空 →
// 回退 deriveRequirements（扫所有视觉实体·连色块都列出「该配什么美术」）。让美术库对任何生成的游戏都有内容。
export function deriveForGame(manifest, game = '') {
  const led = deriveLedger(manifest, { game });
  return led.rows.length ? led : deriveRequirements(manifest, { game });
}

async function run(argv) {
  const cmd = argv[0], slug = argv[1];
  // 全命令共享的开关（提前声明·避免 fill 分支在 const 声明前引用 → TDZ ReferenceError）。
  const pvi = argv.indexOf('--provider'); const providerArg = pvi >= 0 ? argv[pvi + 1] : null;
  const allowMock = argv.includes('--allow-mock'); // 仅测试/冒烟机械验证·端点永不传
  const debug = argv.includes('--debug'); // 回显发给文生图的完整提示词 + 请求 + curl 命令行（key 打码·owner 2026-07-22）
  if (cmd === 'packs') { console.log(JSON.stringify({ packs: listStylePacks() })); return; }
  if (cmd === 'derive') {
    const mf = readJson(manifestFile(ROOT, slug), null);
    if (!mf) { console.error(`无 manifest: library/${slug}/manifest.json`); process.exit(1); }
    const prev = readJson(ledgerFile(ROOT, slug), null); // append-only：重跑并入现台账·编号不漂移
    // deriveForGame：art: 槽为主，纯色块游戏回退需求推导（owner 2026-07-11「生成的游戏美术库空」）。
    const ledger = mergeLedger(prev, deriveForGame(mf, slug), mf); // 带 manifest：slot 还在只是已钉死 ≠ 墓碑
    writeJson(ledgerFile(ROOT, slug), ledger);
    console.log(JSON.stringify({ ok: true, slug, rows: ledger.rows.length, ledger }));
    return;
  }
  // 编译期游戏线·单槽点名生成（无 manifest·写回=skinKey 别名登记）：fill <game> <no> <packId> [--query q] [--mock]
  if (cmd === 'fill') {
    const no = argv[2], packId = argv[3];
    const qi = argv.indexOf('--query'); const query = qi >= 0 ? argv[qi + 1] : undefined;
    const mock = argv.includes('--mock');
    const ledger = readJson(ledgerFile(ROOT, slug), null);
    if (!ledger) { console.error(`无台账: public/games/${slug}/art/art-ledger.json`); process.exit(1); }
    const rr = resetRow(ledger, no, { query });
    if (!rr.ok) { console.log(JSON.stringify(rr)); process.exit(1); }
    const b = await batchGenerate(ledger, packId, { game: slug, mock, only: no, provider: providerArg, debug });
    if (!b.ok) { console.log(JSON.stringify(b)); process.exit(1); }
    writeJson(ledgerFile(ROOT, slug), ledger);
    console.log(JSON.stringify({ ok: true, slug, no, summary: b.summary, row: ledger.rows.find((r) => r.no === no) }));
    return;
  }
  if (cmd === 'batch') {
    const packId = argv[2];
    const mock = argv.includes('--mock');
    const ledger = readJson(ledgerFile(ROOT, slug), null);
    if (!ledger) { console.error(`无台账: 先 derive ${slug}`); process.exit(1); }
    const res = await batchGenerate(ledger, packId, { game: slug, mock, provider: providerArg, debug });
    if (res.ok) writeJson(ledgerFile(ROOT, slug), res.ledger);
    console.log(JSON.stringify(res.ok ? { ok: true, slug, packId, summary: res.summary } : res));
    if (!res.ok) process.exit(1);
    return;
  }
  if (cmd === 'replace') {
    const mf = readJson(manifestFile(ROOT, slug), null);
    const ledger = readJson(ledgerFile(ROOT, slug), null);
    if (!mf || !ledger) { console.error('缺 manifest 或台账'); process.exit(1); }
    const res = applyReplacements(mf, ledger, { allowMock });
    writeJson(ledgerFile(ROOT, slug), res.ledger);
    console.log(JSON.stringify({ ok: true, slug, replaced: res.replaced, skippedMock: res.skippedMock, manifest: res.manifest }));
    return;
  }
  // T2 点名「重新生成」单槽（可改 query）：reset 该行 → 批处理只重跑它 → 重钉引用。
  if (cmd === 'regen') {
    const no = argv[2], packId = argv[3];
    const qi = argv.indexOf('--query'); const query = qi >= 0 ? argv[qi + 1] : undefined;
    const mock = argv.includes('--mock');
    const mf = readJson(manifestFile(ROOT, slug), null); const ledger = readJson(ledgerFile(ROOT, slug), null);
    if (!mf || !ledger) { console.error('缺 manifest 或台账'); process.exit(1); }
    const rr = resetRow(ledger, no, { query });
    if (!rr.ok) { console.log(JSON.stringify(rr)); process.exit(1); }
    const b = await batchGenerate(ledger, packId, { game: slug, mock, only: no, provider: providerArg, debug });
    if (!b.ok) { console.log(JSON.stringify(b)); process.exit(1); }
    const rep = applyReplacements(mf, ledger, { allowMock });
    writeJson(ledgerFile(ROOT, slug), ledger);
    console.log(JSON.stringify({ ok: true, slug, no, summary: b.summary, manifest: rep.manifest, row: ledger.rows.find((r) => r.no === no) }));
    return;
  }
  // T2 点名「从共享库选换 / 上传替换」单槽（不重生成·直接钉已存在资产 id）。
  if (cmd === 'swap') {
    const no = argv[2], assetId = argv[3];
    const source = argv.includes('--upload') ? 'upload' : 'library';
    const mf = readJson(manifestFile(ROOT, slug), null); const ledger = readJson(ledgerFile(ROOT, slug), null);
    if (!mf || !ledger) { console.error('缺 manifest 或台账'); process.exit(1); }
    const sw = swapSlot(mf, ledger, no, assetId, { source });
    if (!sw.ok) { console.log(JSON.stringify(sw)); process.exit(1); }
    writeJson(ledgerFile(ROOT, slug), ledger);
    console.log(JSON.stringify({ ok: true, slug, no, manifest: sw.manifest, row: sw.row }));
    return;
  }
  // T2 换皮：slug=新卡带（apollo 已 copy 好 manifest+台账）→ 全行重跑新风格包 → 重钉引用。
  if (cmd === 'reskin') {
    const packId = argv[2]; const mock = argv.includes('--mock');
    const mf = readJson(manifestFile(ROOT, slug), null); const ledger = readJson(ledgerFile(ROOT, slug), null);
    if (!mf || !ledger) { console.error('reskin 缺 manifest/台账（apollo 应先 copy 新卡带）'); process.exit(1); }
    ledger.game = slug; resetAllRows(ledger);
    const b = await batchGenerate(ledger, packId, { game: slug, mock });
    if (!b.ok) { console.log(JSON.stringify(b)); process.exit(1); }
    const rep = applyReplacements(mf, ledger, { allowMock });
    writeJson(ledgerFile(ROOT, slug), ledger);
    console.log(JSON.stringify({ ok: true, slug, packId, summary: b.summary, manifest: rep.manifest }));
    return;
  }
  console.error('用法: art-replace.mjs <derive|batch|replace|regen|fill|swap|reskin|packs> <slug> [no|packId] [assetId] [--query q] [--mock|--upload]');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) run(process.argv.slice(2));
