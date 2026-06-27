// ════════════════════════════════════════════════════════════════════════
//  Game X《残响》—— 关系记录 v2（持久化 + 羁绊 + 记忆 + 相册 + 阶段 + 称呼）
//
//  GDD §三/八/六：关系成长(不可速成) + 记忆即灵魂 + 共同记忆。
//  全部纯数据 + 纯函数 helper（宿主调用·localStorage 持久·跨会话真实时间流动）。
// ════════════════════════════════════════════════════════════════════════

import type { Companion } from './characters.js';
import type { SessionRecord, AlbumEntry, RelationStage } from './companion.js';

export const DEFAULT_RECORD: SessionRecord = {
  lastSeenMs: 0, firstMetMs: 0, emotionTemp: 0.15, interactions: 0,
  bond: 8, memories: [], album: [], gifts: [], dailyTopics: [], lastDay: '',
};

function recKey(id: string): string { return `gx-rec-${id}`; }

export function loadRecord(id: string): SessionRecord {
  try {
    const raw = globalThis.localStorage?.getItem(recKey(id));
    if (raw) return { ...DEFAULT_RECORD, ...JSON.parse(raw) };
  } catch { /* 损坏存档忽略 */ }
  return { ...DEFAULT_RECORD };
}
export function saveRecord(id: string, rec: SessionRecord): void {
  try { globalThis.localStorage?.setItem(recKey(id), JSON.stringify(rec)); } catch { /* 无存储仅本会话 */ }
}

// 读字段（带缺省·兼容旧档）。
export const bondOf = (r: SessionRecord): number => r.bond ?? Math.round((r.emotionTemp ?? 0) * 100);
export const memoriesOf = (r: SessionRecord): string[] => r.memories ?? [];
export const albumOf = (r: SessionRecord): AlbumEntry[] => r.album ?? [];
export const giftsOf = (r: SessionRecord): string[] => r.gifts ?? [];

// 跨日重置今日话题（每天的话题当天聊过即消·明天再开）。
export function rolloverDay(r: SessionRecord, dayKey: string): SessionRecord {
  if (r.lastDay === dayKey) return r;
  return { ...r, lastDay: dayKey, dailyTopics: [] };
}

// 羁绊增减（夹 [0,100]）+ 同步情感温度显示。
export function addBond(r: SessionRecord, delta: number): SessionRecord {
  const bond = Math.max(0, Math.min(100, bondOf(r) + delta));
  return { ...r, bond, emotionTemp: bond / 100 };
}

export function addMemory(r: SessionRecord, fact: string): SessionRecord {
  const memories = memoriesOf(r);
  if (memories.includes(fact)) return r;
  return { ...r, memories: [...memories, fact] };
}

export function addAlbum(r: SessionRecord, entry: AlbumEntry): SessionRecord {
  const album = albumOf(r);
  if (album.some((a) => a.key === entry.key)) return r;
  return { ...r, album: [...album, entry] };
}

export function markTopic(r: SessionRecord, topic: string): SessionRecord {
  const t = r.dailyTopics ?? [];
  if (t.includes(topic)) return r;
  return { ...r, dailyTopics: [...t, topic] };
}
export const topicDone = (r: SessionRecord, topic: string): boolean => (r.dailyTopics ?? []).includes(topic);

// ── 关系阶段（GDD §八：真实天数 × 互动质量·不可速成）────────────────────────
export function stageOfRecord(r: SessionRecord, nowMs: number): RelationStage {
  const days = r.firstMetMs ? (nowMs - r.firstMetMs) / 86_400_000 : 0;
  const bond = bondOf(r);
  if (days >= 60 && bond >= 70 && r.interactions >= 40) return 'deep'; // 亲近/相守
  if (days >= 14 && bond >= 35) return 'familiar'; // 熟悉
  return 'acquaint'; // 初识
}
export const STAGE_LABEL: Record<RelationStage, string> = { acquaint: '初识', familiar: '熟悉', deep: '亲近' };
export const stageNum = (s: RelationStage): number => (s === 'deep' ? 2 : s === 'familiar' ? 1 : 0);

// 称呼（阶段 × 角色·GDD §八 行为变化）：初识=你的名 / 熟悉=半称 / 亲近=昵称。
export function addressOf(c: Companion, stage: RelationStage): string {
  if (c.id === 'mika') return stage === 'deep' ? '小笨蛋' : stage === 'familiar' ? '你' : '那个……你';
  return stage === 'deep' ? '你啊' : stage === 'familiar' ? '你' : '同学';
}

// ── 记忆图鉴（fact id → 人读「她了解你的」一句·懂你档案展示）────────────────
export const MEMORY_DEX: Record<string, string> = {
  hates_rain: '你说过你不喜欢下雨天',
  making_game: '你在做一个游戏',
  night_owl: '你常常熬夜',
  likes_quiet: '你喜欢安静地待着',
  tired_lately: '你最近很累',
  likes_cat: '你喜欢猫',
};
