import React from 'react';
import { Engine } from '../../../runtime/engine.js';
import type { Resource, Flag, State, ResourceModify } from '@engine/protocol/components.js';
import { useWorldVersion } from '@ui/hooks/use-engine.js';
import { useComponent } from '@ui/hooks/use-component.js';
import {
  MATERIALS,
  GARMENTS,
  COIN_ID,
  COIN_NAME,
  composeAishePrompt,
  garmentFlagId,
  type Garment,
} from '../theme.js';
import { GIRL_ENTITY } from '../blueprint.js';

// ═══════════════════════════════════════════════════════════════
//  Game C 工坊预览（React-DOM 表现层）。**只读世界态渲染**，不含游戏规则。
//  三消核心玩法 = 引擎能力 REQ-C-001（建设中）：本预览的棋盘是静态展示，
//  升级/换装/展示链是真·数据驱动（event-when + effect-apply）——
//  下方「模拟掉落」按钮只是把 ResourceModify 当数据灌进去（等同未来棋盘的产出），
//  好让人亲眼看到这条数据链点亮。表现层 .tsx 是对第一性原则的已知负债（同 game-b VNStage）。
// ═══════════════════════════════════════════════════════════════

const PINK = '#ff7aa2';
const PANEL = 'rgba(255, 250, 252, 0.96)';
const INK = '#5b3a4a';

function hex(tint: number): string {
  return `#${(tint & 0xffffff).toString(16).padStart(6, '0')}`;
}

// 预览棋盘的确定性填充（纯表现，不是游戏状态）。
function previewKind(i: number): number {
  return ((i * 2654435761) >>> 0) % MATERIALS.length;
}

// ── 材料计数条 ──
function MaterialChip({ engine, id, glyph, name, tint }: {
  engine: Engine; id: string; glyph: string; name: string; tint: number;
}) {
  const r = useComponent<Resource>(engine, `mat_${id}`, 'Resource');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
      background: '#fff', borderRadius: 10, border: `1px solid ${hex(tint)}55`,
      boxShadow: `0 1px 4px ${hex(tint)}22`,
    }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8, background: `${hex(tint)}33`,
        display: 'grid', placeItems: 'center', fontSize: 16,
      }}>{glyph}</span>
      <span style={{ fontSize: 11, color: INK, opacity: 0.7 }}>{name}</span>
      <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: INK }}>{r?.current ?? 0}</span>
    </div>
  );
}

// ── 缝纫店一件衣服（解锁进度 + 状态）──
function GarmentRow({ engine, g }: { engine: Engine; g: Garment }) {
  const flag = useComponent<Flag>(engine, `flag_${g.id}`, 'Flag');
  const unlocked = flag?.active ?? false;
  return (
    <div style={{
      padding: 10, borderRadius: 12,
      background: unlocked ? 'linear-gradient(135deg,#fff0f5,#ffe3ef)' : '#fff',
      border: `1px solid ${unlocked ? PINK : '#eedde6'}`,
      opacity: unlocked ? 1 : 0.95,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{g.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{g.name}</span>
        <span style={{ fontSize: 10, color: '#a98', marginLeft: 2 }}>· Lv.{g.tier}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 99,
          background: unlocked ? PINK : '#f0e2ea', color: unlocked ? '#fff' : '#b59',
        }}>{unlocked ? '已解锁 ✓' : '锁定'}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {g.requires.map((req) => (
          <ReqPill key={req.material} engine={engine} material={req.material} amount={req.amount} />
        ))}
      </div>
    </div>
  );
}

function ReqPill({ engine, material, amount }: { engine: Engine; material: string; amount: number }) {
  const r = useComponent<Resource>(engine, `mat_${material}`, 'Resource');
  const m = MATERIALS.find((x) => x.id === material)!;
  const cur = Math.min(r?.current ?? 0, amount);
  const pct = Math.round((cur / amount) * 100);
  const done = (r?.current ?? 0) >= amount;
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      fontSize: 10, color: done ? '#2e7d52' : INK,
      padding: '3px 8px', borderRadius: 99,
      background: '#f6eef2', border: `1px solid ${done ? '#7fd6a3' : '#e7d6df'}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0, width: `${pct}%`,
        background: `${hex(m.tint)}33`, transition: 'width 0.3s',
      }} />
      <span style={{ position: 'relative' }}>{m.glyph} {r?.current ?? 0}/{amount}</span>
    </div>
  );
}

// ── 顶层 ──
export function AtelierStage({ engine }: { engine: Engine }): React.ReactElement {
  useWorldVersion(engine);
  const look = useComponent<State>(engine, GIRL_ENTITY, 'State');
  const lookId = look?.current ?? 'look_base';
  const currentGarment = GARMENTS.find((g) => g.lookId === lookId);
  const prompt = composeAishePrompt(lookId);

  // 预览演示：把材料产出当数据灌进世界（等同未来三消棋盘 REQ-C-001 的消除产出）。
  const simulateDrop = () => {
    const drops: Record<string, number> = {
      cloth: 22, thread: 16, button: 10, ribbon: 12, lace: 14, sequin: 12, [COIN_ID]: 120,
    };
    for (const [id, amount] of Object.entries(drops)) {
      engine.world.addComponent(`mat_${id}`, { type: 'ResourceModify', resourceId: id, amount } as ResourceModify);
    }
  };

  return (
    <div style={{
      width: 920, maxWidth: '96vw', height: 560, maxHeight: '94vh', display: 'flex', gap: 14,
      padding: 16, borderRadius: 18, color: INK,
      background: 'linear-gradient(160deg,#ffe9f1,#fdf6ff)',
      fontFamily: '"PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      boxShadow: '0 20px 60px rgba(180,90,130,0.35)', boxSizing: 'border-box',
    }}>
      {/* 左：三消棋盘预览 */}
      <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Header title="缝纫物语" subtitle="Stitch & Style · 三消工坊" />
        <div style={{ position: 'relative', flex: 1, background: PANEL, borderRadius: 14, padding: 12 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, height: '100%',
          }}>
            {Array.from({ length: 42 }, (_, i) => {
              const m = MATERIALS[previewKind(i)];
              return (
                <div key={i} style={{
                  background: `${hex(m.tint)}2e`, border: `1px solid ${hex(m.tint)}55`,
                  borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 18,
                }}>{m.glyph}</div>
              );
            })}
          </div>
          <div style={{
            position: 'absolute', left: 12, right: 12, bottom: 12,
            background: 'rgba(91,58,74,0.86)', color: '#fff', fontSize: 11,
            padding: '8px 10px', borderRadius: 10, lineHeight: 1.5,
          }}>
            🧩 三消核心玩法 = 引擎能力建设中（<b>REQ-C-001</b>）。
            棋盘交换 / 消除 / 下落 / 补块 / 连锁需引擎下沉为通用 capability，PC 已提需求、不在游戏层 hack。
          </div>
        </div>
      </div>

      {/* 右：材料 + 缝纫店 + 爱诗展示 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, overflow: 'auto' }}>
        {/* 材料 */}
        <Section title="材料仓 · 消除产出">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {MATERIALS.map((m) => (
              <MaterialChip key={m.id} engine={engine} id={m.id} glyph={m.glyph} name={m.name} tint={m.tint} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <CoinChip engine={engine} />
            <button onClick={simulateDrop} style={{
              marginLeft: 'auto', padding: '7px 14px', fontSize: 12, fontWeight: 700,
              color: '#fff', background: `linear-gradient(135deg,${PINK},#ff9ec7)`,
              border: 'none', borderRadius: 10, cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(255,122,162,0.4)',
            }}>▶ 模拟一波消除掉落（预览 · 代 REQ-C-001）</button>
          </div>
        </Section>

        {/* 缝纫店 */}
        <Section title="缝纫店 · 升级阶梯（攒够材料自动解锁）">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GARMENTS.map((g) => <GarmentRow key={g.id} engine={engine} g={g} />)}
          </div>
        </Section>

        {/* 爱诗展示 */}
        <Section title="爱诗展示 · AIGP 视频输出">
          <div style={{
            display: 'flex', gap: 12, padding: 12, borderRadius: 12,
            background: 'linear-gradient(135deg,#2a2140,#3a2a52)', color: '#f3e8ff',
          }}>
            <div style={{
              flex: '0 0 96px', height: 150, borderRadius: 10,
              background: 'linear-gradient(160deg,#ffd9ec,#d9b8ff)',
              display: 'grid', placeItems: 'center', fontSize: 52,
            }}>{currentGarment?.icon ?? '🧍‍♀️'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>当前换装</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                {currentGarment?.name ?? '练习服'}
              </div>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>爱诗视频提示词（数据驱动 · X4 ShadowDictionary）</div>
              <div style={{
                fontSize: 11, lineHeight: 1.5, color: '#e9d5ff',
                background: 'rgba(0,0,0,0.28)', borderRadius: 8, padding: 8,
                maxHeight: 66, overflow: 'auto',
              }}>{prompt}</div>
              <button disabled style={{
                marginTop: 8, padding: '6px 14px', fontSize: 11, fontWeight: 700,
                color: '#cbb6e6', background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'not-allowed',
              }}>🎬 生成爱诗短视频（视频后端待 REQ-C-004）</button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function CoinChip({ engine }: { engine: Engine }) {
  const r = useComponent<Resource>(engine, `mat_${COIN_ID}`, 'Resource');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#b8860b' }}>
      <span style={{ fontSize: 16 }}>🪙</span>{COIN_NAME} {r?.current ?? 0}
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900, color: PINK, letterSpacing: 1 }}>{title}</div>
      <div style={{ fontSize: 11, color: INK, opacity: 0.6 }}>{subtitle}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: PANEL, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: PINK, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
