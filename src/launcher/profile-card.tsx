// 玩家档案卡（REQ-C-104·PST 域·launcher 设置区）——最小档案入口：名字 + 预设头像。
// 存 localStorage["apollo.playerProfile"]（键取自 services/profile 单一真相）；游戏侧只读 API
// getPlayerProfile() 消费。**不做上传**（上传走资产线·属后期）；预设头像=emoji·零新增文件。
// 本组件是 launcher 产品壳（非游戏 UI），沿用既有 React 壳层风格（SHELL 令牌·同 SettingsPanel），不走 LayoutNode。
import { useState } from 'react';
import { SHELL, sBtn, sInput } from '../ui/shell-theme.js';
import { getPlayerProfile, PLAYER_PROFILE_KEY } from '../services/profile/index.js';

// 预设头像闭集（emoji·零资产文件）。选中即以 emoji 串存入 avatarUrl。
const PRESET_AVATARS = ['🦊', '🐼', '🐯', '🐧', '🦉', '🐺', '🐰', '🐲', '🎭', '👤'] as const;

const PANEL_W = 'min(420px, 94vw)';

export function ProfileCard({ onClose, onSaved }: {
  onClose: () => void;
  /** 保存/清除成功回调（上层可据此刷新展示）。 */
  onSaved?: () => void;
}) {
  const current = getPlayerProfile();
  const [name, setName] = useState(current?.name ?? '');
  const [avatar, setAvatar] = useState<string | undefined>(current?.avatarUrl);
  const [tick, setTick] = useState<'' | 'saved' | 'cleared'>('');

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const save = () => {
    if (!canSave) return;
    const profile = { name: trimmed, ...(avatar ? { avatarUrl: avatar } : {}) };
    localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
    setTick('saved');
    onSaved?.();
  };

  const clear = () => {
    localStorage.removeItem(PLAYER_PROFILE_KEY);
    setName('');
    setAvatar(undefined);
    setTick('cleared');
    onSaved?.();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 320 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: PANEL_W, height: '100%', overflowY: 'auto',
          background: SHELL.bg1, borderLeft: `1px solid ${SHELL.lineStrong}`,
          boxShadow: '-16px 0 48px rgba(0,0,0,0.5)', padding: '22px 24px',
          fontFamily: SHELL.fontUi, color: SHELL.text,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {/* 头 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.6 }}>👤 玩家档案</span>
          <button onClick={onClose} aria-label="关闭" style={{ background: 'none', border: 'none', color: SHELL.dim, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: SHELL.sub, lineHeight: 1.6 }}>
          设一张角色卡（名字 + 头像）。游戏启动时主角以此身份呈现——座位铭牌、结算屏都用它。
          只存本机，绝不上传。留空不设即用游戏内置默认「主角」。
        </div>

        {/* 预览 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${SHELL.line}`, borderRadius: 10 }}>
          <span style={{ fontSize: 34, lineHeight: 1 }}>{avatar ?? '🙂'}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, letterSpacing: 2, color: SHELL.dim }}>主角</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: trimmed ? SHELL.text : SHELL.dim }}>{trimmed || '（未命名·用默认「主角」）'}</span>
          </div>
        </div>

        {/* 名字 */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11, color: SHELL.dim, letterSpacing: 0.5 }}>名字</span>
          <input
            aria-label="玩家名字"
            value={name}
            maxLength={24}
            placeholder="例：夜華"
            onChange={(e) => { setName(e.target.value); setTick(''); }}
            style={{ ...sInput(), fontSize: 14, padding: '9px 11px' }}
          />
        </label>

        {/* 预设头像 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, color: SHELL.dim, letterSpacing: 0.5 }}>头像（预设）</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESET_AVATARS.map((emo) => {
              const on = avatar === emo;
              return (
                <button
                  key={emo}
                  aria-label={`头像 ${emo}`}
                  aria-pressed={on}
                  onClick={() => { setAvatar(on ? undefined : emo); setTick(''); }}
                  style={{
                    width: 44, height: 44, fontSize: 24, lineHeight: 1, cursor: 'pointer', outline: 'none',
                    background: on ? SHELL.jadeWash : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${on ? SHELL.jadeLine : SHELL.line}`,
                    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {emo}
                </button>
              );
            })}
          </div>
        </div>

        {/* 底部：保存 / 清除 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <button onClick={save} disabled={!canSave} style={{ ...sBtn('primary'), padding: '9px 20px', fontSize: 14, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            保存档案
          </button>
          <button onClick={clear} style={{ ...sBtn('quiet'), fontSize: 12 }}>清除</button>
          {tick === 'saved' && <span style={{ fontSize: 12, color: SHELL.ok }}>✓ 已保存</span>}
          {tick === 'cleared' && <span style={{ fontSize: 12, color: SHELL.dim }}>已清除，将用默认</span>}
        </div>
      </div>
    </div>
  );
}
