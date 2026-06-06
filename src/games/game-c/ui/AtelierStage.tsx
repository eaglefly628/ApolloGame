import React, { useRef, useState } from 'react';
import { Engine } from '../../../runtime/engine.js';
import type { Resource, State } from '@engine/protocol/components.js';
import { useWorldVersion } from '@ui/hooks/use-engine.js';
import { useComponent } from '@ui/hooks/use-component.js';
import {
  MATERIALS, GARMENTS, COIN_ID, COIN_NAME, SHOP_LEVEL_NAME,
  composeFullLook, AISHE_NEGATIVE,
} from '../theme.js';
import { GIRL_ENTITY, SHOP_LEVEL_ENTITY } from '../blueprint.js';
import { NullAishePort } from '../../../services/aigp/index.js';
import type { AisheVideoHandle } from '../../../services/aigp/index.js';

// ═══════════════════════════════════════════════════════════════
//  Game C 侧面板（React-DOM 表现层）。**只读世界态渲染**，不含游戏规则。
//  棋盘 + 缝制按钮在左侧画板（match3-board + clickable + craft-recipe 世界实体）；
//  本面板展示材料仓 / 缝纫店等级 / 爱诗(AIGP)输出点。爱诗点 NullAishePort（占位句柄；
//  接真后端换 HttpAishePort 即出片，sim 外旁路）。表现层 .tsx 是已知负债（同 game-b VNStage）。
// ═══════════════════════════════════════════════════════════════

const PINK = '#ff7aa2';
const PANEL = 'rgba(255,250,252,0.96)';
const INK = '#5b3a4a';
const hex = (tint: number) => `#${(tint & 0xffffff).toString(16).padStart(6, '0')}`;

function MaterialChip({ engine, id, glyph, name, tint }: {
  engine: Engine; id: string; glyph: string; name: string; tint: number;
}) {
  const r = useComponent<Resource>(engine, `mat_${id}`, 'Resource');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '5px 9px',
      background: '#fff', borderRadius: 9, border: `1px solid ${hex(tint)}55`,
    }}>
      <span style={{ width: 22, height: 22, borderRadius: 7, background: `${hex(tint)}33`, display: 'grid', placeItems: 'center', fontSize: 14 }}>{glyph}</span>
      <span style={{ fontSize: 11, color: INK, opacity: 0.7 }}>{name}</span>
      <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: INK }}>{r?.current ?? 0}</span>
    </div>
  );
}

export function AtelierStage({ engine }: { engine: Engine }): React.ReactElement {
  useWorldVersion(engine);
  const look = useComponent<State>(engine, GIRL_ENTITY, 'State');
  const shopLv = useComponent<Resource>(engine, SHOP_LEVEL_ENTITY, 'Resource');
  const coin = useComponent<Resource>(engine, `mat_${COIN_ID}`, 'Resource');
  const lookId = look?.current ?? 'look_base';
  const currentGarment = GARMENTS.find((g) => g.lookId === lookId);
  const prompt = composeFullLook(lookId, []);

  const portRef = useRef(new NullAishePort());
  const [video, setVideo] = useState<AisheVideoHandle | null>(null);
  const [busy, setBusy] = useState(false);
  const onGenerate = async () => {
    setBusy(true);
    const h = await portRef.current.generate(prompt, { aspect: '9:16', negativePrompt: AISHE_NEGATIVE, seconds: 6 });
    setVideo(h);
    setBusy(false);
  };

  return (
    <div style={{
      width: 340, maxWidth: '92vw', maxHeight: '92vh', overflow: 'auto',
      display: 'flex', flexDirection: 'column', gap: 12, color: INK,
      fontFamily: '"PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: PINK, letterSpacing: 1 }}>缝纫物语</div>
        <div style={{ fontSize: 11, color: INK, opacity: 0.6 }}>Stitch &amp; Style · v0.3 可玩三消工坊</div>
      </div>

      <div style={{ fontSize: 11, color: INK, opacity: 0.75, background: PANEL, borderRadius: 10, padding: '8px 10px', lineHeight: 1.6 }}>
        🧩 点棋盘相邻两格交换，凑成 3+ 同色消除攒材料。<br />
        🪡 材料够了点左侧「缝制按钮」做新衣（缝纫店升级 + 换装）。<br />
        🎬 下面用「爱诗」把当前换装生成短视频展示。
      </div>

      <Section title={`材料仓（消除产出）· ${SHOP_LEVEL_NAME} Lv.${shopLv?.current ?? 0}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
          {MATERIALS.map((m) => (
            <MaterialChip key={m.id} engine={engine} id={m.id} glyph={m.glyph} name={m.name} tint={m.tint} />
          ))}
        </div>
        <div style={{ marginTop: 7, fontSize: 13, fontWeight: 800, color: '#b8860b' }}>🪙 {COIN_NAME} {coin?.current ?? 0}</div>
      </Section>

      <Section title="爱诗展示 · AIGP 视频输出">
        <div style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 12, background: 'linear-gradient(135deg,#2a2140,#3a2a52)', color: '#f3e8ff' }}>
          <div style={{ flex: '0 0 84px', height: 132, borderRadius: 10, background: 'linear-gradient(160deg,#ffd9ec,#d9b8ff)', display: 'grid', placeItems: 'center', fontSize: 46 }}>
            {currentGarment?.icon ?? '🧍‍♀️'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>当前换装</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{currentGarment?.name ?? '练习服'}</div>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>爱诗提示词（数据驱动 · X4 ShadowDictionary）</div>
            <div style={{ fontSize: 10.5, lineHeight: 1.5, color: '#e9d5ff', background: 'rgba(0,0,0,0.28)', borderRadius: 8, padding: 7, maxHeight: 58, overflow: 'auto' }}>{prompt}</div>
            <button onClick={onGenerate} disabled={busy} style={{
              marginTop: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700,
              color: busy ? '#cbb6e6' : '#2a1f3a', background: busy ? 'rgba(255,255,255,0.12)' : 'linear-gradient(135deg,#f9a8d4,#c4b5fd)',
              border: 'none', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
            }}>{busy ? '生成中…' : '🎬 生成爱诗短视频'}</button>
          </div>
        </div>
        {video && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#f3eaff', border: '1px solid #d9c7f5', fontSize: 11, color: '#5b3a6a', lineHeight: 1.6 }}>
            ✅ 爱诗视频已生成（占位句柄 <code>{video.id}</code>，9:16）。<br />
            <span style={{ opacity: 0.75 }}>当前 NullAishePort 返回占位 <code>{video.url}</code>；接入真后端 HttpAishePort 即输出真实短视频。</span>
          </div>
        )}
      </Section>
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
