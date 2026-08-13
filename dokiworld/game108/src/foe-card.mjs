// dokiworld/game108 · 对手卡来源判定（**纯函数零规则**·降级链的机读真相）。
//
// 规范 §7：character 模块是「对手=平台卡」的正路——授权了 character.identity 的宿主
// 能给出**当前授权角色资料**（PublicCharacter），比 init.input 里塞的卡更权威。
// 降级链（缺哪级都不空白·§12「scope 缺失场景有降级行为」）：
//   ① grantedScopes 含 character.identity 且宿主真返回了角色 → 用它；
//   ② 否则 init.input.data.card（首包老路）；
//   ③ 否则游戏内置 DEFAULT_CARD（不 setCard 即是）。
// 本模块只做「查哪级 + 平台形状搬运」，卡的语义解析仍全在引擎卡桥 fromPlatformCard——
// 这里多解析一个字段都算越线。

/** init.grantedScopes 里有没有某个 scope（宿主没给数组时按零授权算）。 */
export function hasScope(grantedScopes, scope) {
  return Array.isArray(grantedScopes) && grantedScopes.includes(scope);
}

/**
 * SDK PublicCharacter → 引擎卡桥的 PlatformCharacterDraft（**键名搬运，不解析语义**）。
 * PublicCharacter（character.d.ts）：{ id, name, description?, avatarUrl?, portraitUrl?, tags? }
 * 平台卡草稿是平铺媒体键（services/character-card/types.ts）：portraitUrl 落到 imageUrl 位
 * （桥的取图序 avatarUrl → imageUrl，正好与「头像优先、立绘兜底」的语义对上）。
 * 非法输入（null/非对象）返回 null——调用方降级到下一级。
 */
export function characterToDraft(character) {
  if (!character || typeof character !== 'object') return null;
  const { id, name, description, avatarUrl, portraitUrl } = character;
  return {
    ...(typeof id === 'string' ? { id } : {}),
    ...(typeof name === 'string' ? { name } : {}),
    ...(typeof description === 'string' ? { description } : {}),
    ...(typeof avatarUrl === 'string' && avatarUrl ? { avatarUrl } : {}),
    ...(typeof portraitUrl === 'string' && portraitUrl ? { imageUrl: portraitUrl } : {}),
  };
}

/**
 * 降级链选源（纯判定·不发请求）：给三态测试一个机读落点。
 * character = 宿主真拿回来的角色资料（查过且非 null 才传）；inputCard = init.input.data.card。
 */
export function pickFoeSource({ character, inputCard }) {
  if (character && typeof character === 'object') return 'character';
  if (inputCard && typeof inputCard === 'object') return 'input';
  return 'default';
}
