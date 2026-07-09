import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SHELL, sBtn, sLabel, sChip, sBadge } from '../ui/shell-theme.js';
import { mount as mountGameQ } from '../games/game-q/index.js';

// ═══════════════════════════════════════════════════════════════
//  game-q 美术工坊（数据透视器·重设计版·标杆）—— 把「游戏=数据」做成看得见的美术管线入口。
//  左：game-q **活场景渲染窗**（复用卡带 mount()·ThreeRenderer 自理·不碰 P3D 域）。
//  右：这局**需要哪些美术**——从台账 `/games/game-q/art/game-q-art-ledger.json` 读、**按类型分组**
//      （3D 模型 / 精灵 / 贴图 / UI…）。选中一项 → 看它的槽位/查询词/占位/provenance。
//  数据源=已落进标准游戏美术目录的台账（`deriveRequirements` 产物·编号 art-NN·确定性）。
//  operate（生成/替换）走 REQ-DEMO-T2 的 /api/art/*（PST 域）——本面板先做「加载+看需求」，
//    操作接线随 T2 收口，避免与 PST 撞车。
// ═══════════════════════════════════════════════════════════════

interface Need {
  readonly no: string;
  readonly kind: string;
  readonly slot: { entity: string; component: string; field: string };
  readonly query: string;
  readonly placeholder: { current: string; source: string; count: number; instances: string[] };
  readonly spec?: Record<string, unknown>;
  readonly context: string;
  readonly status: string;
  readonly gen?: unknown;
  readonly provenance?: unknown;
}
interface Ledger {
  readonly version: number;
  readonly game: string;
  readonly count: number;
  readonly rows: Need[];
}

const KIND_LABEL: Record<string, string> = {
  model3d: '🧊 3D 模型',
  sprite: '👾 精灵',
  texture: '🖼 贴图',
  ui: '🎛 UI',
  particle: '✨ 粒子',
  material: '🎨 材质',
};

export function GameQArtCockpit({ onBack }: { onBack: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  // ① 加载 game-q 活场景（卡带 mount → cleanup；ThreeRenderer 自建·失败不炸壳）。
  useEffect(() => {
    const div = stageRef.current;
    if (!div) return;
    let cleanup = () => {};
    try {
      cleanup = mountGameQ(div);
    } catch {
      /* 无 WebGL / 渲染环境缺失时降级：只展台需求列表，不阻塞 */
    }
    return () => {
      try { cleanup(); } catch { /* noop */ }
      div.innerHTML = '';
    };
  }, []);

  // ② 拉这局的美术需求台账（标准游戏美术目录·可 fetch）。
  useEffect(() => {
    fetch('/games/game-q/art/game-q-art-ledger.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => setLedger(j as Ledger))
      .catch((e) => setLoadErr(`台账加载失败：${String(e)}（需 python3 apollo.py 起 vite）`));
  }, []);

  // 按类型分组（3D/精灵/贴图/UI…）。
  const groups = useMemo(() => {
    const g = new Map<string, Need[]>();
    for (const r of ledger?.rows ?? []) {
      const arr = g.get(r.kind) ?? [];
      arr.push(r);
      g.set(r.kind, arr);
    }
    return [...g.entries()];
  }, [ledger]);

  const selected = useMemo(() => ledger?.rows.find((r) => r.no === sel) ?? null, [ledger, sel]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: SHELL.appBg, color: SHELL.text, display: 'flex', flexDirection: 'column', fontFamily: SHELL.fontUi }}>
      {/* ── 头 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${SHELL.line}`, background: 'rgba(10,14,23,0.95)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: SHELL.violet, whiteSpace: 'nowrap' }}>🎨 game-q 美术工坊</span>
        <span style={{ fontSize: 12, color: SHELL.dim }}>《Neon Siege》· 标杆游戏 · 游戏=数据 → 看这局要哪些美术</span>
        {ledger && <span style={{ ...sChip(false), color: SHELL.jade }}>{ledger.count} 项美术需求</span>}
        <button onClick={onBack} style={{ ...sBtn('ghost'), marginLeft: 'auto' }}>← 返回</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ── 左：活场景渲染窗 ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${SHELL.line}` }}>
          <div style={{ ...sLabel, padding: '8px 14px 4px' }}>游戏场景（活渲染 · ThreeRenderer 盒庭）</div>
          <div ref={stageRef} style={{ flex: 1, minHeight: 0, position: 'relative', background: '#03050b', overflow: 'hidden' }} />
          <div style={{ padding: '6px 14px', fontSize: 11, color: SHELL.dim, borderTop: `1px solid ${SHELL.line}` }}>
            现全程序化图元（占位）· 右侧每项=一个可换真美术的槽位（art-NN·编号确定性）
          </div>
        </div>

        {/* ── 右：按类型的美术需求 + 选中详情 ── */}
        <div style={{ width: 380, flex: 'none', display: 'flex', flexDirection: 'column', background: SHELL.bg1, minHeight: 0 }}>
          <div style={{ ...sLabel, padding: '10px 14px 6px' }}>需要的美术资源 · 按类型</div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
            {loadErr && <div style={{ color: SHELL.warn, fontSize: 12, padding: 10 }}>{loadErr}</div>}
            {!ledger && !loadErr && <div style={{ color: SHELL.dim, fontSize: 12, padding: 10 }}>台账加载中…</div>}
            {groups.map(([kind, rows]) => (
              <div key={kind} style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: SHELL.jade, padding: '4px 6px', display: 'flex', gap: 6 }}>
                  {KIND_LABEL[kind] ?? kind} <span style={{ color: SHELL.dim }}>· {rows.length}</span>
                </div>
                {rows.map((r) => {
                  const active = r.no === sel;
                  return (
                    <div
                      key={r.no}
                      onClick={() => setSel(r.no)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                        background: active ? SHELL.violetWash : 'transparent',
                        border: `1px solid ${active ? SHELL.violetLine : 'transparent'}`,
                      }}
                    >
                      <span style={{ fontFamily: SHELL.fontMono, fontSize: 10, color: SHELL.dim, minWidth: 42 }}>{r.no}</span>
                      <span style={{ flex: 1, color: SHELL.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.slot.entity}</span>
                      {r.placeholder.count > 1 && <span style={{ fontSize: 10, color: SHELL.dim }}>×{r.placeholder.count}</span>}
                      <span style={sBadge(r.status === 'filled' ? 'ok' : 'warn')}>{r.status === 'filled' ? '已填' : '待生成'}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 选中详情 */}
          {selected && (
            <div style={{ flex: 'none', borderTop: `1px solid ${SHELL.line}`, padding: 14, maxHeight: '42%', overflow: 'auto' }}>
              <div style={{ fontSize: 13, color: SHELL.violet, marginBottom: 8 }}>{selected.no} · {selected.slot.entity}</div>
              <Row label="类型">{KIND_LABEL[selected.kind] ?? selected.kind}</Row>
              <Row label="槽位">{selected.slot.entity}.{selected.slot.component}.{selected.slot.field}</Row>
              <Row label="生成查询词">{selected.query}</Row>
              <Row label="当前占位">{selected.placeholder.current}（{selected.placeholder.source}）</Row>
              <Row label="用在">{selected.placeholder.instances.join('、')}</Row>
              {selected.spec && <Row label="规格">{Object.entries(selected.spec).map(([k, v]) => `${k}:${String(v)}`).join(' · ')}</Row>}
              <div style={{ fontSize: 11, color: SHELL.dim, marginTop: 8, lineHeight: 1.5 }}>{selected.context}</div>
              <div style={{ marginTop: 10, fontSize: 11, color: SHELL.dim }}>
                生成/替换（重生成·选换·上传）走 T2 管线 —— 接线随 REQ-DEMO-T2 收口。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12, margin: '3px 0' }}>
      <span style={{ color: SHELL.dim, minWidth: 64, flex: 'none' }}>{label}</span>
      <span style={{ color: SHELL.sub, wordBreak: 'break-all' }}>{children}</span>
    </div>
  );
}
