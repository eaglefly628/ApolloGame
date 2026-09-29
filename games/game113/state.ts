import type { HobbyId } from './data.js';
import { COLLECTIBLES } from './data.js';

export interface AppState {
  onboarded: boolean;
  interests: HobbyId[];
  following: HobbyId[];
  bookmarks: string[];
  likedPosts: string[];
  balance: number;
  owned: string[];
  inspected: string[];
  ledger: { id: string; label: string; amount: number }[];
  ownPosts: { id: string; title: string; text: string; hobbyId: HobbyId }[];
  largeText: boolean;
}

export const INITIAL_STATE: AppState = {
  onboarded: false,
  interests: [],
  following: [],
  bookmarks: [],
  likedPosts: [],
  balance: 2400,
  owned: ['walnut-01'],
  inspected: [],
  ledger: [{ id: 'welcome', label: '演示账户初始雅钱', amount: 2400 }],
  ownPosts: [],
  largeText: false,
};

const toggle = <T,>(items: T[], value: T): T[] => items.includes(value) ? items.filter((x) => x !== value) : [...items, value];
export function toggleInterest(s: AppState, id: HobbyId): AppState { return { ...s, interests: toggle(s.interests, id) }; }
export function toggleFollow(s: AppState, id: HobbyId): AppState { return { ...s, following: toggle(s.following, id) }; }
export function toggleBookmark(s: AppState, id: string): AppState { return { ...s, bookmarks: toggle(s.bookmarks, id) }; }
export function toggleLike(s: AppState, id: string): AppState { return { ...s, likedPosts: toggle(s.likedPosts, id) }; }

export function previewBuy(s: AppState, itemId: string): { state: AppState; error?: string } {
  const item = COLLECTIBLES.find((x) => x.id === itemId);
  if (!item) return { state: s, error: '未找到这件藏品' };
  if (s.owned.includes(itemId)) return { state: s, error: '这件藏品已在你的仓库' };
  if (s.balance < item.price) return { state: s, error: '演示雅钱不足' };
  return {
    state: { ...s, balance: s.balance - item.price, owned: [...s.owned, itemId], ledger: [{ id: `buy-${itemId}`, label: `演示买入 · ${item.name}`, amount: -item.price }, ...s.ledger] },
  };
}

export function previewSell(s: AppState, itemId: string): { state: AppState; error?: string } {
  const item = COLLECTIBLES.find((x) => x.id === itemId);
  if (!item || !s.owned.includes(itemId)) return { state: s, error: '这件藏品不在你的仓库' };
  const amount = Math.round(item.price * 0.95);
  return {
    state: { ...s, balance: s.balance + amount, owned: s.owned.filter((x) => x !== itemId), inspected: s.inspected.filter((x) => x !== itemId), ledger: [{ id: `sell-${itemId}`, label: `演示卖出 · ${item.name}（含 5% 手续费）`, amount }, ...s.ledger] },
  };
}

export function normalizeState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return INITIAL_STATE;
  const p = raw as Partial<AppState>;
  const ids = new Set(COLLECTIBLES.map((x) => x.id));
  const hobbies = new Set(COLLECTIBLES.map((x) => x.hobbyId));
  const validHobbies = (v: unknown): HobbyId[] => Array.isArray(v) ? v.filter((x): x is HobbyId => hobbies.has(x as HobbyId)) : [];
  const validItems = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => ids.has(x as string)) : [];
  return {
    onboarded: p.onboarded === true,
    interests: validHobbies(p.interests),
    following: validHobbies(p.following),
    bookmarks: validItems(p.bookmarks),
    likedPosts: Array.isArray(p.likedPosts) ? p.likedPosts.filter((x): x is string => typeof x === 'string') : [],
    balance: typeof p.balance === 'number' && Number.isFinite(p.balance) && p.balance >= 0 ? p.balance : INITIAL_STATE.balance,
    owned: validItems(p.owned),
    inspected: validItems(p.inspected),
    ledger: Array.isArray(p.ledger) ? p.ledger.filter((x) => x && typeof x.id === 'string' && typeof x.label === 'string' && typeof x.amount === 'number').slice(0, 60) : INITIAL_STATE.ledger,
    ownPosts: Array.isArray(p.ownPosts) ? p.ownPosts.filter((x) => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.text === 'string' && hobbies.has(x.hobbyId)).slice(0, 20) : [],
    largeText: p.largeText === true,
  };
}
