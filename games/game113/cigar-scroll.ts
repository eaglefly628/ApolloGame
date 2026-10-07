/** 成人文化馆的阅历记录知识章节，不对应购买、使用或价格。 */
export const CIGAR_SCROLL_TIERS = [
  { level: 0, name: '初见', achievement: '卷轴尚未展开', chapter: '一支雪茄的内外' },
  { level: 1, name: '识层', achievement: '三层初识', chapter: '一片叶的来处' },
  { level: 2, name: '知叶', achievement: '从田到叶', chapter: '工匠与木模' },
  { level: 3, name: '见工', achievement: '看见手艺', chapter: '一圈纸上的世界' },
  { level: 4, name: '读纸', achievement: '纸上有史', chapter: '留下可信的卷' },
  { level: 5, name: '守证', achievement: '五章成卷', chapter: '自由深读' },
] as const;

export const CIGAR_SCROLL_ARCHIVES = [
  { id: 'notes', label: '我的手记', requiredLevel: 1 },
  { id: 'path', label: '田间与工艺', requiredLevel: 2 },
  { id: 'people', label: '同好议题', requiredLevel: 3 },
  { id: 'culture', label: '工坊与名字 · 文化漫游', requiredLevel: 3 },
  { id: 'objects', label: '纸本与器具档案', requiredLevel: 4 },
] as const;

export type CigarScrollTab = typeof CIGAR_SCROLL_ARCHIVES[number]['id'] | 'guide';
export function cigarScrollTier(completed: number) {
  return CIGAR_SCROLL_TIERS[Math.min(CIGAR_SCROLL_TIERS.length - 1, Math.max(0, Math.floor(completed) || 0))];
}
export function cigarScrollCanOpen(tab: CigarScrollTab, completed: number): boolean {
  if (tab === 'guide') return true;
  const archive = CIGAR_SCROLL_ARCHIVES.find((entry) => entry.id === tab);
  return archive !== undefined && archive.requiredLevel <= completed;
}
