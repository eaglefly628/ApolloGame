// Game I 展示台 · 页 3 · 输入与交互 + 模态/抽屉浮层 + 声音页
// 由 gallery.ts 按 REQ-I-gallery拆分 逐字节搬出（零逻辑改）。入口/组装仍在 gallery.ts。

import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';
import { sectionTitle, divider } from './shared.js';
import type { ControlsState } from './shared.js';
import { SOUNDS, BGM } from '../sounds.js';
// ── 页 3 · 输入与交互 ────────────────────────────────────────
export function buildPageInput(c: ControlsState): LayoutNode {
  return {
  type: 'Panel',
  id: 'page-input',
  props: { scroll: true },
  layout: { direction: 'column', gap: 18, padding: 20 },
  children: [
    sectionTitle('t-btn', 'BUTTON · 三态 + 禁用（→ 信号 click）'),
    {
      type: 'Panel',
      id: 'demo-btn',
      props: {},
      layout: { direction: 'row', gap: 10, padding: 10 },
      children: [
        { type: 'Button', id: 'btn-p', props: { label: '主操作', kind: 'primary', action: 'click', actionArg: 'primary' } },
        { type: 'Button', id: 'btn-g', props: { label: '次操作', kind: 'ghost', action: 'click', actionArg: 'ghost' } },
        { type: 'Button', id: 'btn-q', props: { label: '安静', kind: 'quiet', action: 'click', actionArg: 'quiet' } },
        { type: 'Button', id: 'btn-d', props: { label: '禁用', kind: 'primary', disabled: true, action: 'click', actionArg: 'disabled' } },
      ],
    },
    divider('d-i1'),
    sectionTitle('t-input', 'INPUT · 文本 / 数字（→ 信号 setText / setNum）'),
    {
      type: 'Panel',
      id: 'demo-input',
      props: {},
      layout: { direction: 'row', gap: 10, padding: 10 },
      children: [
        { type: 'Input', id: 'in-text', props: { placeholder: '玩家名称…', type: 'text', action: 'setText' }, layout: { flex: 2 } },
        { type: 'Input', id: 'in-num', props: { placeholder: '数量', type: 'number', value: '1', action: 'setNum' }, layout: { flex: 1 } },
      ],
    },
    sectionTitle('t-dropdown', 'DROPDOWN · 下拉选择（→ 信号 setDifficulty）'),
    {
      type: 'Dropdown',
      id: 'dd-diff',
      props: {
        options: [
          { value: 'easy', label: '简单' },
          { value: 'normal', label: '普通' },
          { value: 'hard', label: '困难' },
        ],
        value: 'normal',
        action: 'setDifficulty',
      },
    },
    divider('d-i2'),
    sectionTitle('t-check', 'CHECKBOX / TOGGLE · 开关（→ 信号 setFlag / setSound）'),
    {
      type: 'Panel',
      id: 'demo-check',
      props: {},
      layout: { direction: 'row', gap: 24, align: 'center', padding: 10 },
      children: [
        { type: 'Checkbox', id: 'cb-tutorial', props: { label: '开启新手引导', checked: c.flag, action: 'setFlag' } },
        { type: 'Toggle', id: 'tg-sound', props: { label: '音效', checked: c.sound, action: 'setSound' } },
      ],
    },
    sectionTitle('t-radio', 'RADIOGROUP · 互斥单选（→ 信号 setSpeed）'),
    {
      type: 'RadioGroup',
      id: 'rg-speed',
      props: {
        name: 'speed',
        options: [
          { value: '1', label: '1×' },
          { value: '2', label: '2×' },
          { value: '4', label: '4×' },
        ],
        value: c.speed,
        action: 'setSpeed',
      },
    },
    divider('d-i3'),
    sectionTitle('t-slider', 'SLIDER · 数值滑块（→ 信号 setVolume）'),
    {
      type: 'Slider',
      id: 'sl-volume',
      props: { min: 0, max: 100, step: 5, value: 60, label: '音量', action: 'setVolume' },
    },
    divider('d-i3b'),
    sectionTitle('t-segmented', 'SEGMENTED · 分段选择器（互斥·紧凑·→ 信号 setView）'),
    {
      type: 'Segmented',
      id: 'seg-view',
      props: {
        options: [
          { value: 'grid', label: '网格' },
          { value: 'list', label: '列表' },
          { value: 'card', label: '卡片' },
        ],
        value: c.view,
        action: 'setView',
      },
    },
    sectionTitle('t-stepper', 'STEPPER · 步进器（±按钮调数值·边界禁用·→ 信号 setQty）'),
    {
      type: 'Stepper',
      id: 'stp-qty',
      props: { value: c.qty, min: 0, max: 10, step: 1, action: 'setQty' },
    },
    sectionTitle('t-combobox', 'COMBOBOX · 可搜索下拉（输入过滤·点项回填·引擎内建 → 信号 setCity）'),
    {
      type: 'Combobox',
      id: 'cb-city',
      props: {
        options: [
          { value: 'cd', label: '成都' },
          { value: 'luoyang', label: '洛阳' },
          { value: 'xuchang', label: '许昌' },
          { value: 'jianye', label: '建业' },
          { value: 'changan', label: '长安' },
        ],
        placeholder: '搜索城市…',
        value: c.city,
        action: 'setCity',
      },
    },
    sectionTitle('t-rating', 'RATING · 星级评分（点星 → 信号 setRating）'),
    {
      type: 'Rating',
      id: 'rt-stars',
      props: { value: c.rating, max: 5, action: 'setRating' },
    },
    divider('d-i4'),
    sectionTitle('t-modal', 'MODAL · 模态浮层（按钮开 → 点遮罩/× 关·引擎内建 closeAction）'),
    {
      type: 'Panel',
      id: 'demo-modal',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 10 },
      children: [
        { type: 'Button', id: 'btn-open-modal', props: { label: '打开模态框', kind: 'primary', action: 'openModal' } },
        { type: 'Label', id: 'modal-hint', props: { text: '点遮罩本身或右上角 × 即关闭', size: 'sm', color: 'dim' } },
      ],
    },
    divider('d-i4b'),
    sectionTitle('t-drawer', 'DRAWER · 抽屉浮层（按钮开 → 右侧滑入·点遮罩/× 关·引擎内建）'),
    {
      type: 'Panel',
      id: 'demo-drawer',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 10 },
      children: [
        { type: 'Button', id: 'btn-open-drawer', props: { label: '打开抽屉', kind: 'primary', action: 'openDrawer' } },
        { type: 'Label', id: 'drawer-hint', props: { text: '从右侧滑入·遮罩/× 关闭', size: 'sm', color: 'dim' } },
      ],
    },
    divider('d-i4c'),
    sectionTitle('t-ctxmenu', 'CONTEXTMENU · 右键菜单（在下方区域点右键 → 光标处弹菜单·引擎内建 → ctxAction）'),
    {
      type: 'ContextMenu',
      id: 'demo-ctxmenu',
      props: {
        items: [
          { id: 'open', label: '打开', action: 'ctxAction' },
          { id: 'rename', label: '重命名', action: 'ctxAction' },
          { id: 'dup', label: '复制', action: 'ctxAction' },
          { id: 'delete', label: '删除', action: 'ctxAction' },
        ],
      },
      children: [
        {
          type: 'Panel',
          id: 'ctx-target',
          props: { title: '右键点我' },
          layout: { direction: 'column', gap: 4, padding: 18, align: 'center' },
          children: [
            { type: 'Label', id: 'ctx-hint', props: { text: '在此区域点鼠标右键，菜单会在光标处弹出', color: 'sub', size: 'sm' } },
          ],
        },
      ],
    },
    divider('d-i5'),
    sectionTitle('t-toast-live', 'TOAST · 实时飘字（点击 → showToast·底部居中堆叠·到时自动消失）'),
    {
      type: 'Panel',
      id: 'demo-toast-live',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 10 },
      children: [
        { type: 'Button', id: 'btn-toast-ok', props: { label: '成功提示', kind: 'primary', action: 'showToast', actionArg: 'ok' } },
        { type: 'Button', id: 'btn-toast-warn', props: { label: '警告提示', kind: 'ghost', action: 'showToast', actionArg: 'warn' } },
        { type: 'Button', id: 'btn-toast-danger', props: { label: '错误提示', kind: 'ghost', action: 'showToast', actionArg: 'danger' } },
      ],
    },
  ],
  };
}

// ── 模态浮层（按需叠加于 Screen 之上）─────────────────────────
// Modal 是满屏遮罩浮层：开 = 宿主把它挂进树重渲染；关 = 引擎内建（点遮罩/× → closeModal）。
// 模态/抽屉浮层节点（导出供宿主作「独立浮层」挂载·不进画廊树 → 开关不触发画廊重渲）。
export const modalOverlay: LayoutNode = {
  type: 'Modal',
  id: 'demo-modal-overlay',
  props: { title: '示例模态框', size: 'md', closable: true, closeAction: 'closeModal' },
  layout: {},
  children: [
    { type: 'Label', id: 'mo-body', props: { text: '这是一个数据驱动的模态浮层——标题/尺寸/可关均由数据配置。', color: 'sub' } },
    { type: 'Divider', id: 'mo-div', props: {} },
    {
      type: 'Panel',
      id: 'mo-actions',
      props: {},
      layout: { direction: 'row', gap: 10, align: 'center', padding: 0 },
      children: [
        { type: 'Tag', id: 'mo-tag', props: { label: '弹窗内也能放控件', tone: 'accent' } },
        { type: 'Button', id: 'mo-ok', props: { label: '知道了', kind: 'primary', action: 'closeModal' } },
      ],
    },
  ],
};

// ── 抽屉浮层（按需叠加·右侧滑入·开靠宿主、关靠引擎内建 closeAction）─────
export const drawerOverlay: LayoutNode = {
  type: 'Drawer',
  id: 'demo-drawer-overlay',
  props: { side: 'right', title: '示例抽屉', closeAction: 'closeDrawer' },
  layout: {},
  children: [
    { type: 'Label', id: 'dw-body', props: { text: '抽屉常用于侧边设置 / 详情面板，从屏幕一侧滑入。', color: 'sub' } },
    { type: 'Divider', id: 'dw-div', props: {} },
    { type: 'Toggle', id: 'dw-tg', props: { label: '抽屉里的开关', checked: true, action: 'setFlag' } },
    { type: 'Button', id: 'dw-ok', props: { label: '收起抽屉', kind: 'primary', action: 'closeDrawer' } },
  ],
};

// ── 页 6 · 声音测试（Web Audio 合成·无需音频文件）────────────────
export function buildSoundPage(c: ControlsState): LayoutNode {
  return {
    type: 'Panel',
    id: 'page-sound',
    props: { scroll: true },
    layout: { direction: 'column', gap: 16, padding: 20 },
    children: [
      {
        type: 'Panel', id: 'snd-hud', props: {},
        layout: { direction: 'row', gap: 12, align: 'center', padding: 12 },
        children: [
          { type: 'Label', id: 'snd-title', props: { text: '🔊 声音测试', size: 'lg', bold: true }, layout: { flex: 1 } },
          { type: 'Badge', id: 'snd-engine', props: { text: 'Web Audio 合成 · 无需音频文件', tone: 'dim' } },
        ],
      },
      { type: 'Label', id: 'snd-hint', props: { text: '点按钮播放合成音（纯频率/波形数据驱动）。下方可调音量、静音。', color: 'dim', size: 'sm' } },
      sectionTitle('snd-t-play', '单音 · 点击播放（→ 信号 playSound·应用当前声像/混响）'),
      {
        type: 'Panel', id: 'demo-sounds', props: {},
        layout: { direction: 'grid', minCol: 120, gap: 10, padding: 8 },
        children: SOUNDS.map((s): LayoutNode => ({
          type: 'Button', id: `snd-${s.id}`,
          props: { label: s.label, kind: 'ghost', action: 'playSound', actionArg: s.id },
        })),
      },
      divider('snd-d1'),
      sectionTitle('snd-t-mix', '混音 · 多音同时发声（Web Audio 天然混合·多声道）'),
      {
        type: 'Panel', id: 'snd-mix', props: {},
        layout: { direction: 'row', gap: 10, align: 'center', padding: 8 },
        children: [
          { type: 'Button', id: 'snd-chord', props: { label: '🎶 和弦（3 音齐发）', kind: 'primary', action: 'playChord', actionArg: 'major' } },
          { type: 'Button', id: 'snd-all', props: { label: '💥 8 音齐发', kind: 'ghost', action: 'playChord', actionArg: 'all' } },
        ],
      },
      divider('snd-d2'),
      sectionTitle('snd-t-pan', '立体声 · 左右声像（StereoPanner·-100 左 ~ +100 右）'),
      {
        type: 'Panel', id: 'snd-pan', props: {},
        layout: { direction: 'column', gap: 10, padding: 8 },
        children: [
          { type: 'Slider', id: 'snd-pan-sl', props: { min: -100, max: 100, step: 10, value: c.pan, label: `声像 ${c.pan < 0 ? '偏左' : c.pan > 0 ? '偏右' : '居中'}`, action: 'setPan' } },
          {
            type: 'Panel', id: 'snd-pan-btn', props: {},
            layout: { direction: 'row', gap: 10, align: 'center', padding: 0 },
            children: [
              { type: 'Button', id: 'snd-pan-l', props: { label: '◀ 左', kind: 'ghost', action: 'playPan', actionArg: 'left' } },
              { type: 'Button', id: 'snd-pan-c', props: { label: '● 中', kind: 'ghost', action: 'playPan', actionArg: 'center' } },
              { type: 'Button', id: 'snd-pan-r', props: { label: '右 ▶', kind: 'ghost', action: 'playPan', actionArg: 'right' } },
              { type: 'Label', id: 'snd-pan-hint', props: { text: '戴耳机更明显', size: 'sm', color: 'dim' } },
            ],
          },
        ],
      },
      divider('snd-d3'),
      sectionTitle('snd-t-bgm', '背景音乐 · 循环播放（音序数据驱动）'),
      {
        type: 'Panel', id: 'snd-bgm', props: {},
        layout: { direction: 'row', gap: 10, align: 'center', padding: 8 },
        children: [
          ...BGM.map((b): LayoutNode => ({
            type: 'Button', id: `snd-bgm-${b.id}`,
            props: { label: `▶ ${b.label}`, kind: 'ghost', action: 'startBgm', actionArg: b.id },
          })),
          { type: 'Button', id: 'snd-bgm-stop', props: { label: '⏹ 停止', kind: 'quiet', action: 'stopBgm' } },
        ],
      },
      divider('snd-d4'),
      sectionTitle('snd-t-ctl', '混响 / 音量 / 静音'),
      {
        type: 'Panel', id: 'snd-ctl', props: {},
        layout: { direction: 'column', gap: 12, padding: 8 },
        children: [
          { type: 'Toggle', id: 'snd-reverb', props: { label: '混响（Convolver 卷积）', checked: c.reverb, action: 'toggleReverb' } },
          { type: 'Slider', id: 'snd-vol', props: { min: 0, max: 100, step: 5, value: c.vol, label: '音量', action: 'setSndVol' } },
          { type: 'Toggle', id: 'snd-mute', props: { label: c.muted ? '静音（已静音·点此恢复）' : '静音', checked: c.muted, action: 'toggleMute' } },
        ],
      },
    ],
  };
}
