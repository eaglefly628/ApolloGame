// 剧情起手 · 立绘/表情链（REQ-DIALOGUE M2·PUI 半——表结构 + 解析 + 分级降级；PA 半=真图走美术台账）。
//
// 数据契约：`EmotionArtTable` = characterId × emotion → assetKey（**纯数据表**·最弱 LLM 能填）。
// 解析：`resolveEmotionArt(table, characterId, emotion)` 出 assetKey + 命中层级——**分级降级绝不空白/报错**：
//   指定情绪有图 → exact；缺 → 回退角色的 `neutral` → neutral；再缺 → none（portrait 控件自身出名首字/剪影占位）。
// 接线：assetKey 由**游戏** `resolveAsset` 解析成 URL（sim 持 key·URL 不进画面）→ 喂 portrait.art / buildPresence。
// 真图产出走美术台账（等文生图真 key 只影响出图·不影响本接线）；此处只管「情绪→哪张 key」的确定性选择与降级。
import type { LayoutNode } from '@ui/components/index.js';

/** 立绘表情表（纯数据）：characterId → { emotion → assetKey }。约定 `neutral` 键为降级锚（缺情绪回退它）。 */
export type EmotionArtTable = Record<string, Record<string, string>>;

/** 降级命中层级：exact=命中指定情绪 / neutral=回退到中性 / none=无图（portrait 出占位·绝不空白）。 */
export type ArtFallback = 'exact' | 'neutral' | 'none';

/** 情绪→立绘资产 key（分级降级·确定性·绝不空白/报错）。返回 assetKey（none 时 undefined）+ 命中层级（可上报/调试）。 */
export function resolveEmotionArt(table: EmotionArtTable, characterId: string, emotion?: string): { key?: string; fallback: ArtFallback } {
  const row = table[characterId];
  if (!row) return { fallback: 'none' };                                  // 角色无表 → 占位
  if (emotion && row[emotion]) return { key: row[emotion], fallback: 'exact' }; // 命中指定情绪
  if (row['neutral']) return { key: row['neutral'], fallback: 'neutral' };      // 回退中性锚
  return { fallback: 'none' };                                            // 连中性都缺 → 占位
}

/**
 * 便捷：把「表情表 + 角色 + 游戏的 resolveAsset」合成一个 `resolveArt(emotion) → URL?` 回调，喂 `buildPresence`/portrait。
 * **双级降级绝不空白**：① emotion→key（表缺情绪→neutral 锚·`resolveEmotionArt`）；② key→URL 若缺图（key 在表但真图未产出）
 *   → 再退到 neutral 锚的图。两级都拿不到 → undefined（portrait 出剪影/名首字占位）。
 * `resolveAsset` 是**游戏侧**函数（sim 持 key·经资产索引出 URL）；@ui/starters 不碰资产解析（保解耦）。
 */
export function emotionArtResolver(
  table: EmotionArtTable,
  characterId: string,
  resolveAsset: (key: string) => string | undefined,
): (emotion?: string) => string | undefined {
  return (emotion) => {
    const { key } = resolveEmotionArt(table, characterId, emotion);
    if (key) { const url = resolveAsset(key); if (url) return url; }      // ① 情绪 key 有图
    const neutral = table[characterId]?.['neutral'];                     // ② 缺图 → 退中性锚的图（art 级降级）
    if (neutral && neutral !== key) { const url = resolveAsset(neutral); if (url) return url; }
    return undefined;                                                    // 两级皆缺 → 占位（不空白）
  };
}

/** 示范表情表（一角色·四情绪 + 中性锚）。游戏抄它把 assetKey 换成自己台账里的真 key（缺的情绪自动降级到 neutral）。 */
export const SAMPLE_EMOTION_ART: EmotionArtTable = {
  '林清越': { neutral: 'lin/neutral', happy: 'lin/happy', warm: 'lin/warm', shy: 'lin/shy', excited: 'lin/excited' },
};

// 便捷类型别名：portrait art 解析回调（供 buildPresence 等消费·见 presence.ts）。
export type ArtResolver = (emotion?: string) => string | undefined;

// 断言用（测试/文档）：一个 LayoutNode portrait 是否被解析出 art（便于点名测试读取）。
export function portraitArtOf(node: LayoutNode): string | undefined {
  return (node.props as { art?: string }).art;
}
