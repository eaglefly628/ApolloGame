/** 清酒馆阅历只代表已走过的知识章节，不评价人的品味，也不与雅钱挂钩。 */
export const SAKE_SCROLL_TIERS = [
  { level: 0, name: '初访', achievement: '卷轴尚未展开', chapter: '时间的门' },
  { level: 1, name: '辨史', achievement: '时序初明', chapter: '米的另一种命运' },
  { level: 2, name: '识麹', achievement: '米麹之识', chapter: '读懂一张酒标' },
  { level: 3, name: '读标', achievement: '一纸有据', chapter: '名字之外的土地' },
  { level: 4, name: '寻源', achievement: '知其来处', chapter: '时间会留下什么' },
  { level: 5, name: '守藏', achievement: '五章成卷', chapter: '自由探索' },
] as const;

export const SAKE_SCROLL_ARCHIVES = [
  { id: 'culture', label: '历史与传说', requiredLevel: 1 },
  { id: 'notes', label: '我的手记', requiredLevel: 1 },
  { id: 'path', label: '酿造与酒标', requiredLevel: 2 },
  { id: 'people', label: '同好议题', requiredLevel: 2 },
  { id: 'brands', label: '品牌目录', requiredLevel: 3 },
  { id: 'cellar', label: '名酒深读', requiredLevel: 3 },
  { id: 'world', label: '世界酒藏', requiredLevel: 4 },
  { id: 'appreciation', label: '鉴赏与收藏', requiredLevel: 5 },
  { id: 'hundred', label: '百酒深读', requiredLevel: 5 },
] as const;

export type SakeScrollTab = typeof SAKE_SCROLL_ARCHIVES[number]['id'] | 'guide' | 'rankings' | 'sources';

export function sakeScrollTier(completed: number) {
  return SAKE_SCROLL_TIERS[Math.min(SAKE_SCROLL_TIERS.length - 1, Math.max(0, Math.floor(completed) || 0))];
}

export function sakeScrollCanOpen(tab: SakeScrollTab, completed: number): boolean {
  if (tab === 'guide' || tab === 'rankings' || tab === 'sources') return true;
  const archive = SAKE_SCROLL_ARCHIVES.find((entry) => entry.id === tab);
  return archive !== undefined && archive.requiredLevel <= completed;
}
