// AI 原生编辑器 · 后端调用（main_entry/editor_projects.py + 既有 agent/chat、library manifest、platforms 端点）。
import type { Pointer } from './project-model.js';

export const API = 'http://localhost:4000';

export interface ProjectSummary { id: string; name: string; assets: number; updated: number }
export interface Change { at: string; by: 'human' | 'ai'; path: string; pointer?: Pointer; from?: unknown; to?: unknown; summary?: string }
export interface FileResp { success: boolean; path?: string; json?: unknown; text?: string; parseError?: string; error?: string }
export interface AgentResp { success: boolean; reply?: string; manifest?: unknown; manifestError?: string; error?: string }

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  return (await res.json()) as T;
}
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const editorApi = {
  list: () => call<{ success: boolean; projects?: ProjectSummary[]; error?: string }>('/api/editor/projects'),
  create: (name: string) => call<{ success: boolean; id?: string; error?: string }>('/api/editor/projects', post({ name })),
  project: (slug: string) => call<{ success: boolean; project?: unknown; error?: string }>(`/api/editor/projects/${slug}`),
  file: (slug: string, path: string) => call<FileResp>(`/api/editor/projects/${slug}/file?path=${encodeURIComponent(path)}`),
  edit: (slug: string, path: string, pointer: Pointer, value: unknown) =>
    call<{ success: boolean; change?: Change; unchanged?: boolean; error?: string }>(`/api/editor/projects/${slug}/edit`, post({ path, pointer, value })),
  note: (slug: string, path: string, summary: string) => call<{ success: boolean }>(`/api/editor/projects/${slug}/note`, post({ path, summary })),
  changes: (slug: string) => call<{ success: boolean; changes?: Change[] }>(`/api/editor/projects/${slug}/changes`),
  /** 既有 AI 对话（策划角色）：上下文 = 入口场景 manifest + 设计底案；回包可带改后的 manifest。 */
  agent: (slug: string, content: string) => call<AgentResp>('/api/agent/chat', post({ slug, role: 'gd', messages: [{ role: 'user', content }] })),
  /** 既有落盘端点：先过引擎真校验再写 manifest.json + 存一版。 */
  saveManifest: (slug: string, manifest: unknown, note: string) =>
    call<{ success: boolean; error?: string }>(`/api/library/${slug}/manifest`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest, note }) }),
  launchPlatform: (id: string) => call<{ success: boolean; url?: string; error?: string }>(`/api/platforms/${id}/launch`, post({})),
};
