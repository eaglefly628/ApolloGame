// Game I · 回调层（HandlerMap）。
//
// 红线（契约 §3）：布局数据只出现「信号名字符串」（action: string）；
// 「按下去干什么」由工程师在这里写。数据与逻辑只在信号名处相遇。
//
// 测试场的逻辑很简单：把每个控件发来的信号 + 当前值打进事件日志，
// 让你直观看到「填数据即出 UI、动一下就有信号」。换皮信号 setTheme 交给宿主重挂。

import type { HandlerMap } from '@ui/components/index.js';

export interface GalleryHooks {
  /** 把一条信号写进事件日志。 */
  log: (action: string, arg?: string) => void;
  /** 切换主题令牌包（宿主负责重挂载整棵树）。 */
  setTheme: (value: string) => void;
  /** 记住当前 Tab（mountUI 已就地切页·此处只记录，使后续重挂不回弹第一页）。 */
  setTab: (id: string) => void;
  /** 开/关演示模态浮层（宿主状态驱动·重挂载整棵树）。 */
  setModal: (open: boolean) => void;
  /** 开/关演示抽屉浮层（宿主状态驱动·重挂载整棵树）。 */
  setDrawer: (open: boolean) => void;
  /** 弹一条实时飘字提示（宿主调引擎 showToast·到时自动消失）。tone 取自按钮 actionArg。 */
  toast: (tone?: string) => void;
  /** 改世界资源（演示 resolveBindings 活 HUD）：受伤/治疗后宿主重绑重挂。 */
  hurt: (amount: number) => void;
  heal: (amount: number) => void;
  /** 组合演示「商店」的联动信号（kind=cat/search/select/qty/buy）→ 宿主跑 reducer 重挂。 */
  shopDispatch: (kind: string, arg?: string) => void;
  /** 组合演示「选牌」的联动信号（kind=toggle/drop/play/clear）→ 宿主跑 reducer 重挂。 */
  pickDispatch: (kind: string, arg?: string) => void;
}

export function buildHandlers(hooks: GalleryHooks): HandlerMap {
  const L = hooks.log;
  return {
    click: (a) => L('click', a),
    setText: (a) => L('setText', a),
    setNum: (a) => L('setNum', a),
    setDifficulty: (a) => L('setDifficulty', a),
    setFlag: (a) => L('setFlag', a),
    setSound: (a) => L('setSound', a),
    setSpeed: (a) => L('setSpeed', a),
    setVolume: (a) => L('setVolume', a),
    pickRow: (a) => L('pickRow', a),
    pickVRow: (a) => L('pickVRow', a),
    ctxAction: (a) => L('ctxAction', a),
    pickTag: (a) => L('pickTag', a),
    pickCard: (a) => L('pickCard', a),
    setView: (a) => L('setView', a),
    setQty: (a) => L('setQty', a),
    setCity: (a) => L('setCity', a),
    setRating: (a) => L('setRating', a),
    toggleAcc: (a) => L('toggleAcc', a),
    switchTab: (a) => { L('switchTab', a); if (a) hooks.setTab(a); },
    setTheme: (a) => {
      L('setTheme', a);
      if (a) hooks.setTheme(a);
    },
    openModal: (a) => {
      L('openModal', a);
      hooks.setModal(true);
    },
    closeModal: (a) => {
      L('closeModal', a);
      hooks.setModal(false);
    },
    openDrawer: (a) => {
      L('openDrawer', a);
      hooks.setDrawer(true);
    },
    closeDrawer: (a) => {
      L('closeDrawer', a);
      hooks.setDrawer(false);
    },
    showToast: (a) => {
      L('showToast', a);
      hooks.toast(a);
    },
    hurt: (a) => {
      L('hurt', a);
      hooks.hurt(Number(a) || 10);
    },
    heal: (a) => {
      L('heal', a);
      hooks.heal(Number(a) || 10);
    },
    // 商店联动：信号名 → reducer 类别（视图与逻辑只在信号名处相遇）。
    shopCat: (a) => { L('shopCat', a); hooks.shopDispatch('cat', a); },
    shopSearch: (a) => { L('shopSearch', a); hooks.shopDispatch('search', a); },
    shopSelect: (a) => { L('shopSelect', a); hooks.shopDispatch('select', a); },
    shopQty: (a) => { L('shopQty', a); hooks.shopDispatch('qty', a); },
    shopBuy: (a) => { L('shopBuy', a); hooks.shopDispatch('buy', a); },
    // 选牌联动：点选/拖入/结算/清空。
    pickHand: (a) => { L('pickHand', a); hooks.pickDispatch('toggle', a); },
    dropPick: (a) => { L('dropPick', a); hooks.pickDispatch('drop', a); },
    playHand: (a) => { L('playHand', a); hooks.pickDispatch('play', a); },
    clearHand: (a) => { L('clearHand', a); hooks.pickDispatch('clear', a); },
  };
}
