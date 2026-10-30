import {STARTER_THEME} from '../../src/ui/starters/index.js';
import type {UITheme} from '../../src/ui/components/index.js';
/** User-directed bright cartoon variation; retains the house nine-slice candy controls. */
export function workbenchTheme():UITheme{
 return {...STARTER_THEME,
  bg0:'#1168bd',bg1:'#fff3d8',bg2:'#fffaf0',bg3:'#e2f1ff',
  pageBg:'linear-gradient(150deg,#319fe8 0%,#1679d3 52%,#0b4d9c 100%)',
  mine:'#ffffff',foe:'#fff9e5',text:'#173554',sub:'#355576',dim:'#55708c',ink:'#12304e',line:'#234767',
  jade:'#0877cc',jadeWash:'linear-gradient(180deg,#249ee9,#0e75c8)',jadeLine:'#12304e',gold:'#ffd23f',
  ok:'#267e45',okWash:'#d8f2ba',warn:'#9a5b0d',warnWash:'#ffe7a5',danger:'#b63031',inputBg:'#fffdf7',
  texture:undefined,panelTexture:undefined,cursor:undefined,
  wash:'repeating-conic-gradient(from -12deg at 50% 0%,rgba(255,255,255,.06) 0deg 12deg,transparent 12deg 24deg)',
  fontUi:"'Arial Rounded MT Bold','PingFang SC','Microsoft YaHei',system-ui,sans-serif",
 };
}
