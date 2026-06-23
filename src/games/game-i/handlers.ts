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
  /** 开/关演示模态浮层（宿主状态驱动·重挂载整棵树）。 */
  setModal: (open: boolean) => void;
  /** 弹一条实时飘字提示（宿主调引擎 showToast·到时自动消失）。tone 取自按钮 actionArg。 */
  toast: (tone?: string) => void;
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
    pickTag: (a) => L('pickTag', a),
    switchTab: (a) => L('switchTab', a),
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
    showToast: (a) => {
      L('showToast', a);
      hooks.toast(a);
    },
  };
}
