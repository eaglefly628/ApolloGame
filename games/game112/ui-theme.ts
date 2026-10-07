// house 锦霞基座；owner 明确要求猫馆木作 / 旧纸 / 苔绿，移除外置应用的粉色纹样。
import { apolloBrocade } from '@zerocraft/engine/ui/components/apollo-kit.js';
import type { UITheme } from '@zerocraft/engine/ui/components/index.js';

export const STAR_TAIL_THEME: UITheme = {
  ...apolloBrocade,
  bg0: '#e0cfaf', bg1: '#e8d7b5', bg2: '#f1e2c5', bg3: '#faf0da',
  pageBg: '#292b25', texture: 'none', wash: 'none',
  text: '#392e22', sub: '#63533e', dim: '#63533e',
  line: '#b39a6c', ink: '#30271d',
  gold: '#795016',
  jade: '#38594d', jadeWash: '#e1e6d6', jadeLine: '#819481',
  ok: '#386046', okWash: '#dce5cc', warn: '#795016', warnWash: '#f0dfb6', danger: '#9c3930',
};
