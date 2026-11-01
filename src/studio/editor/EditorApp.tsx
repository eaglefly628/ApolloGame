// ═══════════════════════════════════════════════════════════════
//  ZeroCraft 引擎编辑器 · AI 原生（docs/design/ai-native-editor-2026-11-01.md）
//
//  形态学 Unity/Unreal：项目选择页（Hub）→ 编辑器（资产树 / 场景层级 / 预览 / 属性 / 改动记录 / AI）。
//  开发方式不学：**AI 负责写，编辑器负责让人看懂、指认、验收**。人能手动做的只有
//  看、选、运行，以及在属性面板调标量数值（owner 判乙）；结构性改动全部从 AI 面板发出。
//  目标用户（owner 暂定）：有创作能力的策划。
//
//  本文件是创作平台**产品壳**（非游戏 UI）：沿用 SHELL 令牌 + React，同 DesignStudio 例外；
//  游戏自己的 UI 屏在预览区用 LayoutNode 真渲染（mountUI），不在这里手写。
// ═══════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SHELL } from '../../ui/shell-theme.js';
import { mountUI, apolloOnyx, type MountHandle } from '../../ui/components/index.js';
import type { LayoutNode } from '../../ui/components/types.js';
import { ManifestPreview } from '../DataCartridgeRunner.js';
import { PlatformLauncher } from '../PlatformLauncher.js';
import {
  validateProject, buildAssetTree, sceneHierarchy, flattenValues, coerceEdit, getAt, selectionContext,
  type ProjectIndex, type ProjectAsset, type AssetTreeNode, type Pointer, type ProjectIssue,
} from './project-model.js';
import { editorApi, type ProjectSummary, type Change, type FileResp } from './editor-api.js';

const TYPE_ICON: Record<string, string> = { scene: '🗺', ui: '🪟', table: '📊', doc: '📄', image: '🖼', model: '🧊', motion: '🎞', audio: '🔊' };
/** UI 节点上的结构键：改了等于换控件/断引用，乙档不许手调。 */
const UI_LOCKED = new Set(['type', 'id']);
const TYPE_NAME: Record<string, string> = { scene: '场景', ui: 'UI 屏', table: '数据表', doc: '文档', image: '图片', model: '模型', motion: '动作', audio: '音频' };

const panel: React.CSSProperties = { background: SHELL.bg1, border: `1px solid ${SHELL.line}`, borderRadius: 6, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' };
const panelHead: React.CSSProperties = { padding: '6px 10px', fontSize: 11, letterSpacing: 1, color: SHELL.sub, borderBottom: `1px solid ${SHELL.line}`, background: SHELL.bg2, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 };
const panelBody: React.CSSProperties = { flex: 1, overflow: 'auto', minHeight: 0 };
const btn = (tone: 'jade' | 'violet' | 'plain' = 'plain'): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none',
  background: tone === 'jade' ? SHELL.jadeWash : tone === 'violet' ? SHELL.violetWash : 'transparent',
  color: tone === 'jade' ? SHELL.jade : tone === 'violet' ? SHELL.violet : SHELL.sub,
  border: `1px solid ${tone === 'jade' ? SHELL.jadeLine : tone === 'violet' ? SHELL.violetLine : SHELL.lineStrong}`,
});

// ── 入口：Hub ⇄ 编辑器 ⇄ 旧版创作台 ──
export function EditorApp({ onLegacy }: { onLegacy: () => void }) {
  const [open, setOpen] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('project'); } catch { return null; }
  });
  const go = useCallback((slug: string | null) => {
    setOpen(slug);
    try {
      const u = new URL(window.location.href);
      if (slug) u.searchParams.set('project', slug); else u.searchParams.delete('project');
      window.history.replaceState(null, '', u.toString());
    } catch { /* 无 history（测试环境）不影响 */ }
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: SHELL.appBg, color: SHELL.text, fontFamily: "'PingFang SC','Microsoft YaHei',system-ui,sans-serif", display: 'flex', flexDirection: 'column' }}>
      {open ? <EditorShell slug={open} onClose={() => go(null)} onLegacy={onLegacy} /> : <ProjectHub onOpen={go} onLegacy={onLegacy} />}
    </div>
  );
}

// ── 项目选择页（相当于 Unity Hub）──
export function ProjectHub({ onOpen, onLegacy }: { onOpen: (slug: string) => void; onLegacy: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    editorApi.list().then((r) => { if (r.success) setProjects(r.projects ?? []); else setError(r.error ?? '项目列表读取失败'); })
      .catch(() => setError('连不上本机服务（python3 zerocraft.py 是否在跑？）'));
  }, []);
  const create = async () => {
    setBusy(true); setError(null);
    try {
      const r = await editorApi.create(name.trim());
      if (r.success && r.id) onOpen(r.id); else setError(r.error ?? '新建失败');
    } catch { setError('新建失败：连不上本机服务'); } finally { setBusy(false); }
  };
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '48px 16px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: SHELL.jade, letterSpacing: 2 }}>ZeroCraft 引擎</div>
          <div style={{ fontSize: 12, color: SHELL.dim }}>AI 原生 · 人负责看懂、指认、验收</div>
          <div style={{ flex: 1 }} />
          <button style={btn()} onClick={onLegacy} title="原来的游戏库 / 创作台（老游戏都在这里·保持兼容）">旧版创作台</button>
        </div>
        <div style={{ ...panel, marginTop: 24, padding: 16, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: SHELL.sub }}>新项目</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="游戏名（可留空·编号自动为 new<n>）" onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: `1px solid ${SHELL.lineStrong}`, background: SHELL.bg0, color: SHELL.text, fontSize: 13, outline: 'none' }} />
          <button style={btn('jade')} disabled={busy} onClick={() => void create()}>{busy ? '创建中…' : '＋ 新建项目'}</button>
        </div>
        {error && <div role="alert" style={{ marginTop: 12, color: SHELL.warn, fontSize: 12 }}>{error}</div>}
        <div style={{ marginTop: 24, fontSize: 11, letterSpacing: 1, color: SHELL.dim }}>我的项目</div>
        <div data-testid="project-list" style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {projects === null && !error && <div style={{ color: SHELL.dim, fontSize: 12 }}>读取中…</div>}
          {projects?.length === 0 && <div style={{ gridColumn: '1 / -1', color: SHELL.dim, fontSize: 12 }}>还没有新项目。老游戏在「旧版创作台」。</div>}
          {projects?.map((p) => (
            <button key={p.id} data-project={p.id} onClick={() => onOpen(p.id)}
              style={{ ...panel, padding: 14, textAlign: 'left', cursor: 'pointer', color: SHELL.text, gap: 6 }}>
              <div style={{ fontSize: 22 }}>🗺</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: SHELL.dim }}>{p.id} · {p.assets} 个资产</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type Loaded = { asset: ProjectAsset; file: FileResp | null };

// ── 编辑器主体 ──
export function EditorShell({ slug, onClose, onLegacy }: { slug: string; onClose: () => void; onLegacy: () => void }) {
  const [project, setProject] = useState<ProjectIndex | null>(null);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sel, setSel] = useState<Loaded | null>(null);
  const [entity, setEntity] = useState<string | null>(null);
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [running, setRunning] = useState(true);
  const [runKey, setRunKey] = useState(0);

  const refreshChanges = useCallback(async () => {
    try { const r = await editorApi.changes(slug); if (r.success) setChanges(r.changes ?? []); } catch { /* 记录拉不到不挡编辑 */ }
  }, [slug]);

  const openAsset = useCallback(async (asset: ProjectAsset, keepEntity = false) => {
    if (!keepEntity) { setEntity(null); setPointer(null); }
    if (!asset.path) { setSel({ asset, file: null }); return; }
    try { setSel({ asset, file: await editorApi.file(slug, asset.path) }); }
    catch { setSel({ asset, file: { success: false, error: '读取失败：连不上本机服务' } }); }
  }, [slug]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await editorApi.project(slug);
        if (dead) return;
        if (!r.success) { setLoadError(r.error ?? '项目读取失败'); return; }
        const v = validateProject(r.project);
        setIssues(v.issues);
        if (!v.project) return;
        setProject(v.project);
        const entry = v.project.assets.find((a) => a.id === v.project!.entry);
        if (entry) await openAsset(entry);
        await refreshChanges();
      } catch { if (!dead) setLoadError('连不上本机服务（python3 zerocraft.py 是否在跑？）'); }
    })();
    return () => { dead = true; };
  }, [slug, openAsset, refreshChanges]);

  const reload = useCallback(async () => { if (sel) await openAsset(sel.asset, true); await refreshChanges(); setRunKey((k) => k + 1); }, [sel, openAsset, refreshChanges]);
  const tree = useMemo(() => (project ? buildAssetTree(project.assets) : null), [project]);
  const data = sel?.file?.json;

  if (loadError || (!project && issues.length)) {
    return (
      <div style={{ padding: 32 }}>
        <button style={btn()} onClick={onClose}>← 项目列表</button>
        <div role="alert" style={{ marginTop: 16, color: SHELL.warn, fontSize: 13 }}>{loadError ?? 'project.json 有问题：'}</div>
        {issues.map((i) => <div key={i.path + i.message} style={{ fontSize: 12, color: SHELL.sub, marginTop: 4 }}>· {i.path || '(根)'}：{i.message}</div>)}
      </div>
    );
  }
  if (!project || !tree) return <div style={{ padding: 32, color: SHELL.dim }}>打开项目中…</div>;

  return (
    <>
      {/* 顶栏：项目名 · 运行控制 · 外部平台 · 退出 */}
      <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderBottom: `1px solid ${SHELL.line}`, background: SHELL.bg0, flexShrink: 0 }}>
        <button style={btn()} onClick={onClose} title="回到项目列表">☰</button>
        <span style={{ color: SHELL.jade, fontWeight: 700, letterSpacing: 1 }}>ZeroCraft</span>
        <span style={{ color: SHELL.text, fontSize: 13 }}>{project.name}</span>
        <span style={{ color: SHELL.dim, fontSize: 11 }}>{project.id}</span>
        <div style={{ flex: 1 }} />
        <button data-testid="run-toggle" style={btn(running ? 'violet' : 'jade')} onClick={() => setRunning((r) => !r)}>{running ? '⏸ 暂停预览' : '▶ 运行预览'}</button>
        <button style={btn()} onClick={() => setRunKey((k) => k + 1)} title="从头重跑当前场景">⟲ 重开</button>
        <span style={{ marginTop: -14 }}><PlatformLauncher /></span>
        <button style={btn()} onClick={onLegacy}>旧版创作台</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gap: 6, padding: 6, gridTemplateColumns: '250px minmax(0,1fr) 340px', gridTemplateRows: 'minmax(0,1fr) minmax(0,1fr) 170px' }}>
        <section style={{ ...panel, gridColumn: 1, gridRow: 1 }} aria-label="项目">
          <div style={panelHead}>项目 · 资产</div>
          <div style={panelBody}><AssetTree node={tree} selected={sel?.asset.id} onPick={(a) => void openAsset(a)} /></div>
        </section>
        <section style={{ ...panel, gridColumn: 1, gridRow: 2 }} aria-label="层级">
          <div style={panelHead}>层级{sel ? ` · ${sel.asset.name ?? sel.asset.id}` : ''}</div>
          <div style={panelBody}><Hierarchy loaded={sel} entity={entity} onPick={(id) => { setEntity(id); setPointer(null); }} /></div>
        </section>
        <section style={{ ...panel, gridColumn: 2, gridRow: '1 / 3' }} aria-label="预览">
          <div style={panelHead}>预览 <span style={{ color: SHELL.dim }}>{sel ? `${TYPE_NAME[sel.asset.type]} · ${sel.asset.path ?? `${sel.asset.ref?.platform}:${sel.asset.ref?.id}`}` : ''}</span></div>
          <div style={{ ...panelBody, display: 'flex', alignItems: 'center', justifyContent: 'center', background: SHELL.bg0 }}>
            <Viewport key={`${sel?.asset.id}-${runKey}`} loaded={sel} running={running} />
          </div>
        </section>
        <section style={{ ...panel, gridColumn: 3, gridRow: 1 }} aria-label="属性">
          <div style={panelHead}>属性{entity ? ` · ${entity}` : ''} <span style={{ color: SHELL.dim }}>（可调数值·结构改动请找 AI）</span></div>
          <div style={panelBody}>
            {sel && data !== undefined
              ? <Inspector slug={slug} loaded={sel} entity={entity} pointer={pointer} onPoint={setPointer} onEdited={reload} />
              : <Empty text={sel?.file?.text !== undefined ? '文档资产：在预览区阅读，修改请找 AI。' : '选中一个资产查看属性'} />}
          </div>
        </section>
        <section style={{ ...panel, gridColumn: 3, gridRow: '2 / 4' }} aria-label="AI">
          <div style={panelHead}>✦ AI 助手 <span style={{ color: SHELL.dim }}>（所有开发从这里发出）</span></div>
          <AiPanel slug={slug} project={project} loaded={sel} entity={entity} pointer={pointer} onApplied={reload} />
        </section>
        <section style={{ ...panel, gridColumn: '1 / 3', gridRow: 3 }} aria-label="改动记录">
          <div style={panelHead}>改动记录 <span style={{ color: SHELL.dim }}>人 + AI 同一条流</span></div>
          <div style={panelBody}><ChangeLog changes={changes} /></div>
        </section>
      </div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 16, color: SHELL.dim, fontSize: 12, lineHeight: 1.7 }}>{text}</div>;
}

function AssetTree({ node, selected, onPick, depth = 0 }: { node: AssetTreeNode; selected?: string; onPick: (a: ProjectAsset) => void; depth?: number }) {
  return (
    <div>
      {node.children.map((c) => c.asset ? (
        <div key={c.key} data-asset={c.asset.id} onClick={() => onPick(c.asset!)} title={c.asset.id}
          style={{ padding: `4px 10px 4px ${12 + depth * 14}px`, fontSize: 12, cursor: 'pointer', display: 'flex', gap: 6,
            background: selected === c.asset.id ? SHELL.jadeWash : 'transparent', color: selected === c.asset.id ? SHELL.jade : SHELL.text }}>
          <span>{TYPE_ICON[c.asset.type]}</span><span>{c.label}</span>
        </div>
      ) : (
        <div key={c.key}>
          <div style={{ padding: `4px 10px 4px ${12 + depth * 14}px`, fontSize: 11, color: SHELL.sub }}>▾ {c.label}</div>
          <AssetTree node={c} selected={selected} onPick={onPick} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

function uiNodes(node: unknown, depth = 0, out: { id: string; type: string; depth: number }[] = []) {
  const n = node as { id?: unknown; type?: unknown; children?: unknown } | null;
  if (!n || typeof n !== 'object') return out;
  out.push({ id: String(n.id ?? '?'), type: String(n.type ?? '?'), depth });
  if (Array.isArray(n.children)) n.children.forEach((c) => uiNodes(c, depth + 1, out));
  return out;
}

function Hierarchy({ loaded, entity, onPick }: { loaded: Loaded | null; entity: string | null; onPick: (id: string) => void }) {
  if (!loaded) return <Empty text="选中一个资产" />;
  const data = loaded.file?.json;
  const row = (id: string, label: React.ReactNode, depth = 0) => (
    <div key={id} data-entity={id} onClick={() => onPick(id)}
      style={{ padding: `4px 10px 4px ${12 + depth * 14}px`, fontSize: 12, cursor: 'pointer', background: entity === id ? SHELL.violetWash : 'transparent', color: entity === id ? SHELL.violet : SHELL.text }}>
      {label}
    </div>
  );
  if (loaded.asset.type === 'scene') {
    const rows = sceneHierarchy(data);
    if (!rows.length) return <Empty text="场景里还没有实体——让 AI 加。" />;
    return <div>{rows.map((r) => row(r.id, <>◆ {r.id}{r.template ? <span style={{ color: SHELL.dim }}> ⟨{r.template}⟩</span> : null}{r.repeat !== undefined ? <span style={{ color: SHELL.dim }}> ×{r.repeat}</span> : null}<span style={{ color: SHELL.faint }}> {r.components.length} 组件</span></>))}</div>;
  }
  if (loaded.asset.type === 'ui') return <div>{uiNodes(data).map((n) => row(n.id, <>▫ {n.id} <span style={{ color: SHELL.dim }}>{n.type}</span></>, n.depth))}</div>;
  return <Empty text={`${TYPE_NAME[loaded.asset.type]}没有层级。`} />;
}

function Viewport({ loaded, running }: { loaded: Loaded | null; running: boolean }) {
  if (!loaded) return <Empty text="从左侧选一个资产" />;
  const { asset, file } = loaded;
  if (file && !file.success) return <Empty text={file.error ?? '读取失败'} />;
  if (asset.type === 'scene') {
    if (!running) return <Empty text="预览已暂停。点「▶ 运行预览」。" />;
    return <ManifestPreview manifest={file?.json} />;
  }
  if (asset.type === 'ui') return <UiPreview node={file?.json} />;
  if (asset.type === 'doc') return <pre style={{ alignSelf: 'stretch', margin: 0, padding: 20, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: SHELL.text, fontFamily: 'inherit', width: '100%', overflow: 'auto' }}>{file?.text}</pre>;
  if (asset.type === 'table') return <pre style={{ alignSelf: 'stretch', margin: 0, padding: 20, fontSize: 12, color: SHELL.sub, width: '100%', overflow: 'auto' }}>{JSON.stringify(file?.json, null, 2)}</pre>;
  if (asset.ref) return <RefPreview asset={asset} />;
  return <Empty text="暂不支持预览该资产。" />;
}

function UiPreview({ node }: { node: unknown }) {
  const host = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!host.current) return;
    let h: MountHandle | undefined;
    try { h = mountUI(host.current, node as LayoutNode, {}, apolloOnyx); setErr(null); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    return () => { try { h?.(); } catch { /* 卸载失败不影响下一个预览 */ } };
  }, [node]);
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {err && <Empty text={`UI 屏无法渲染：${err}`} />}
      <div ref={host} data-testid="ui-preview" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

function RefPreview({ asset }: { asset: ProjectAsset }) {
  const [msg, setMsg] = useState<string | null>(null);
  const open = async () => {
    const ref = asset.ref!;
    const win = window.open('about:blank', `zerocraft-${ref.platform}`);
    try {
      const r = await editorApi.launchPlatform(ref.platform);
      if (!r.success || !r.url) throw new Error(r.error ?? '拉起失败');
      // 动画平台工作台支持 /library/?clip=<精确ID> 直达（tools/motion-workbench/README.md）
      const url = ref.platform === 'motion' ? `${r.url.replace(/\/$/, '')}/library/?clip=${encodeURIComponent(ref.id)}` : r.url;
      if (win) win.location.href = url;
    } catch (e) { win?.close(); setMsg(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div style={{ textAlign: 'center', color: SHELL.sub, fontSize: 13 }}>
      <div style={{ fontSize: 40 }}>{TYPE_ICON[asset.type]}</div>
      <div style={{ marginTop: 8 }}>{asset.ref!.platform} : {asset.ref!.id}</div>
      <button style={{ ...btn('violet'), marginTop: 14 }} onClick={() => void open()}>在独立平台中打开</button>
      {msg && <div role="alert" style={{ marginTop: 10, color: SHELL.warn, fontSize: 12 }}>{msg}</div>}
    </div>
  );
}

function Inspector({ slug, loaded, entity, pointer, onPoint, onEdited }: {
  slug: string; loaded: Loaded; entity: string | null; pointer: Pointer | null; onPoint: (p: Pointer) => void; onEdited: () => void;
}) {
  const root = loaded.file?.json;
  const base: Pointer = useMemo(() => {
    if (loaded.asset.type === 'scene' && entity) return ['entities', entity];
    if (loaded.asset.type === 'ui' && entity) {
      const find = (n: unknown, p: Pointer): Pointer | null => {
        const x = n as { id?: unknown; children?: unknown[] } | null;
        if (!x || typeof x !== 'object') return null;
        if (x.id === entity) return p;
        if (Array.isArray(x.children)) for (let i = 0; i < x.children.length; i++) { const hit = find(x.children[i], [...p, 'children', i]); if (hit) return hit; }
        return null;
      };
      return find(root, []) ?? [];
    }
    return [];
  }, [loaded.asset.type, entity, root]);
  const target = base.length ? getAt(root, base) : root;
  const rows = useMemo(() => {
    const all = flattenValues(target, base);
    if (loaded.asset.type !== 'ui') return all;
    // UI 节点只摊自己的字段（子节点在层级里点）；控件类型与 id 是结构，只读（后端同规拒收）
    return all.filter((r) => r.pointer[base.length] !== 'children')
      .map((r) => (r.pointer.length === base.length + 1 && UI_LOCKED.has(String(r.pointer[base.length])) ? { ...r, editable: false } : r));
  }, [target, base, loaded.asset.type]);
  if (loaded.asset.type === 'scene' && !entity) {
    const m = root as { capabilities?: unknown[] } | null;
    return <Empty text={`场景用到 ${Array.isArray(m?.capabilities) ? m!.capabilities.length : 0} 个引擎能力。在层级里选一个实体查看并调数值。`} />;
  }
  return (
    <div style={{ padding: '4px 0' }}>
      {rows.map((r) => <FieldRow key={r.pointer.join('/')} slug={slug} path={loaded.asset.path!} row={r} active={pointer?.join('/') === r.pointer.join('/')} onPoint={onPoint} onEdited={onEdited} />)}
    </div>
  );
}

function FieldRow({ slug, path, row, active, onPoint, onEdited }: {
  slug: string; path: string; row: ReturnType<typeof flattenValues>[number]; active: boolean; onPoint: (p: Pointer) => void; onEdited: () => void;
}) {
  const [text, setText] = useState(String(row.value));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setText(String(row.value)); setErr(null); }, [row.value]);
  const commit = async () => {
    if (text === String(row.value)) return;
    const c = coerceEdit(row.value, text);
    if (!c.ok) { setErr(c.error); return; }
    try {
      const r = await editorApi.edit(slug, path, row.pointer, c.value);
      if (!r.success) { setErr(r.error ?? '保存失败'); return; }
      setErr(null); onEdited();
    } catch { setErr('保存失败：连不上本机服务'); }
  };
  return (
    <div data-field={row.label} onClick={() => onPoint(row.pointer)}
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '3px 10px', alignItems: 'center', background: active ? SHELL.violetWash : 'transparent' }}>
      <span style={{ fontSize: 12, color: SHELL.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.label}>{row.label}</span>
      {row.editable ? (
        <input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => void commit()} onKeyDown={(e) => { if (e.key === 'Enter') void commit(); }}
          aria-label={row.label}
          style={{ padding: '3px 6px', fontSize: 12, borderRadius: 4, border: `1px solid ${err ? SHELL.warn : SHELL.lineStrong}`, background: SHELL.bg0, color: row.kind === 'string' ? SHELL.text : SHELL.jade, outline: 'none', minWidth: 0 }} />
      ) : <span style={{ fontSize: 11, color: SHELL.dim }}>{JSON.stringify(row.value)?.slice(0, 40)}</span>}
      {err && <span role="alert" style={{ gridColumn: '1 / 3', fontSize: 11, color: SHELL.warn }}>{err}</span>}
    </div>
  );
}

function AiPanel({ slug, project, loaded, entity, pointer, onApplied }: {
  slug: string; project: ProjectIndex; loaded: Loaded | null; entity: string | null; pointer: Pointer | null; onApplied: () => void;
}) {
  const [text, setText] = useState('');
  const [log, setLog] = useState<{ who: 'me' | 'ai' | 'sys'; text: string }[]>([]);
  const [pending, setPending] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const ctx = selectionContext(project, loaded ? { asset: loaded.asset, ...(entity ? { entity } : {}), ...(pointer ? { pointer } : {}) } : null);
  // 现阶段 AI 落盘通道 = 既有入口场景 manifest（/api/agent/chat）；其它资产的 AI 写入在 E2 接通（设计文档 §5）。
  const canWrite = loaded?.asset.path === 'manifest.json';
  const send = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setText(''); setBusy(true); setPending(null);
    setLog((l) => [...l, { who: 'me', text: q }]);
    try {
      const r = await editorApi.agent(slug, `${ctx}\n\n${q}`);
      if (!r.success) throw new Error(r.error ?? 'AI 调用失败');
      setLog((l) => [...l, { who: 'ai', text: r.reply ?? '' }, ...(r.manifestError ? [{ who: 'sys' as const, text: `AI 的改动没通过引擎校验：${r.manifestError}` }] : [])]);
      if (r.manifest) setPending(r.manifest);
    } catch (e) {
      setLog((l) => [...l, { who: 'sys', text: e instanceof Error ? e.message : String(e) }]);
    } finally { setBusy(false); }
  };
  const apply = async () => {
    try {
      const r = await editorApi.saveManifest(slug, pending, 'AI 改动（编辑器）');
      if (!r.success) throw new Error(r.error ?? '落盘失败');
      const last = [...log].reverse().find((m) => m.who === 'me')?.text ?? 'AI 改动';
      await editorApi.note(slug, 'manifest.json', last.slice(0, 200));
      setPending(null);
      setLog((l) => [...l, { who: 'sys', text: '已应用，并记入改动记录。' }]);
      onApplied();
    } catch (e) { setLog((l) => [...l, { who: 'sys', text: e instanceof Error ? e.message : String(e) }]); }
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '8px 10px', fontSize: 11, color: SHELL.dim, whiteSpace: 'pre-wrap', borderBottom: `1px solid ${SHELL.line}`, lineHeight: 1.6 }} data-testid="ai-context">{ctx}</div>
      <div style={{ ...panelBody, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!log.length && <div style={{ fontSize: 12, color: SHELL.dim, lineHeight: 1.7 }}>先在左边选中要改的东西，再用一句话告诉 AI。<br />例：「把这个平台挪高一点，再加一个金币」。</div>}
        {log.map((m, i) => (
          <div key={i} style={{ alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '92%', padding: '6px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            background: m.who === 'me' ? SHELL.jadeWash : m.who === 'ai' ? SHELL.bg3 : 'transparent', color: m.who === 'sys' ? SHELL.warn : SHELL.text }}>{m.text}</div>
        ))}
        {pending !== null && <button style={btn('jade')} onClick={() => void apply()}>✓ 应用 AI 的改动</button>}
      </div>
      {!canWrite && loaded && <div style={{ padding: '4px 10px', fontSize: 11, color: SHELL.warn }}>当前阶段 AI 只能直接改入口场景（主关卡）；对这个资产的建议会以文字回复。</div>}
      <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: `1px solid ${SHELL.line}` }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="告诉 AI 要做什么…（Enter 发送 · Shift+Enter 换行）" rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
          style={{ flex: 1, resize: 'none', padding: '6px 8px', borderRadius: 6, border: `1px solid ${SHELL.lineStrong}`, background: SHELL.bg0, color: SHELL.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
        <button style={btn('jade')} disabled={busy} onClick={() => void send()}>{busy ? '…' : '发送'}</button>
      </div>
    </div>
  );
}

function ChangeLog({ changes }: { changes: Change[] }) {
  if (!changes.length) return <Empty text="还没有改动。手调的数值和应用的 AI 改动都会记在这里，AI 也读得到。" />;
  return (
    <div style={{ padding: '4px 0' }}>
      {[...changes].reverse().map((c, i) => (
        <div key={i} style={{ padding: '3px 10px', fontSize: 12, display: 'flex', gap: 10 }}>
          <span style={{ color: SHELL.dim, flexShrink: 0 }}>{c.at.replace('T', ' ')}</span>
          <span style={{ color: c.by === 'ai' ? SHELL.violet : SHELL.jade, flexShrink: 0 }}>{c.by === 'ai' ? 'AI' : '人'}</span>
          <span style={{ color: SHELL.sub, flexShrink: 0 }}>{c.path}</span>
          <span style={{ color: SHELL.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.summary ?? `${(c.pointer ?? []).join('.')}：${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`}
          </span>
        </div>
      ))}
    </div>
  );
}
