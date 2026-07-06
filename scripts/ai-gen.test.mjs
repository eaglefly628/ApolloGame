// AI 资产生成框架自检（mock 路径·无网络）：两个适配器产合法资产 + buildEntry 带 provenance。
import { describe, it, expect } from 'vitest';
import { ADAPTERS, buildEntry, mockImage, encodePng, providerSettings } from './ai-gen.mjs';

describe('ai-gen 框架 · 适配器注册表', () => {
  it('注册了 tripo(3D) + qwen(2D)，各带 kind/envKey/license', () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(['qwen', 'tripo']);
    expect(ADAPTERS.tripo).toMatchObject({ kind: 'mesh', ext: 'glb', envKey: 'TRIPO_API_KEY' });
    expect(ADAPTERS.qwen).toMatchObject({ kind: 'texture', ext: 'png', envKey: 'DASHSCOPE_API_KEY' });
  });
});

describe('ai-gen 框架 · mock 生成产合法资产', () => {
  it('tripo mock → 合法 glb（magic + spec）', async () => {
    const g = await ADAPTERS.tripo.generate('a wooden chair', { mock: true });
    expect(g.mock).toBe(true);
    expect(g.buffer.length).toBeGreaterThan(20);
    expect(g.buffer.readUInt32LE(0)).toBe(0x46546c67); // glTF magic
    expect(g.spec).toMatchObject({ scale: 1, genCollision: 'hull' });
  });

  it('qwen mock → 合法 png，且 prompt 播种（不同词不同图）', async () => {
    const a = await ADAPTERS.qwen.generate('red pixel sword', { mock: true });
    expect(a.mock).toBe(true);
    expect(a.buffer.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG 签名
    expect(a.spec).toMatchObject({ format: 'png', usage: 'sprite' });
    const b = await ADAPTERS.qwen.generate('blue round shield', { mock: true });
    expect(Buffer.compare(a.buffer, b.buffer)).not.toBe(0); // 不同 prompt → 不同 mock 图
  });

  it('缺 key 且非 mock → 回退 mock（不炸·真调需 key+网络）', async () => {
    const g = await ADAPTERS.tripo.generate('x', { mock: false, apiKey: undefined });
    expect(g.mock).toBe(true);
  });

  it('encodePng/mockImage：纯 Node PNG 可解码', () => {
    const { buffer, w, h } = mockImage('hello', 32);
    expect(w).toBe(32); expect(h).toBe(32);
    expect(buffer.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(encodePng(2, 2, Buffer.alloc(2 * 2 * 3)).slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});

describe('ai-gen 框架 · 落库条目（连资产索引这个"数据库"）', () => {
  it('buildEntry 带 provenance（generator/prompt/mock）+ 正确类型/许可', () => {
    const e = buildEntry({ adapter: 'tripo', prompt: 'a chair', id: 'ai/tripo/a-chair', kind: 'mesh', spec: { scale: 1, genCollision: 'hull' }, model: 'tripo-mock', license: 'Tripo (按订阅商用授权)', mock: true, servedPath: '/games/game-z/art/ai/tripo/a-chair.glb', at: '2026-07-04T00:00:00Z' });
    expect(e).toMatchObject({ id: 'ai/tripo/a-chair', type: 'mesh', status: 'filled', source: 'ai:tripo' });
    expect(e.provenance).toMatchObject({ generator: 'tripo', prompt: 'a chair', mock: true });
    expect(e.tags).toContain('ai-gen'); expect(e.tags).toContain('mock');
  });
  it('qwen 图 → texture/ai-gen 类', () => {
    const e = buildEntry({ adapter: 'qwen', prompt: 'sword', id: 'ai/qwen/sword', kind: 'texture', spec: { format: 'png', width: 128, height: 128, usage: 'sprite' }, model: 'wanx-mock', license: 'Qwen/DashScope', mock: true, servedPath: 'ai/qwen/sword.png', at: '' });
    expect(e).toMatchObject({ type: 'texture', category: 'ai-gen', source: 'ai:qwen' });
  });
});

describe('ai-gen 框架 · 设置视图（开放 key 配置·打码不回明文）', () => {
  it('providerSettings 列出 envKey + 是否已配 + 打码', () => {
    const s = providerSettings({ TRIPO_API_KEY: 'tk-abcdef1234567890', DASHSCOPE_API_KEY: '' });
    const tripo = s.find((p) => p.id === 'tripo');
    expect(tripo).toMatchObject({ envKey: 'TRIPO_API_KEY', keyConfigured: true });
    expect(tripo.apiKeyMasked).toBe('tk-***7890'); // 前3***尾4·绝不回明文
    expect(tripo.apiKeyMasked).not.toContain('abcdef');
    expect(s.find((p) => p.id === 'qwen')).toMatchObject({ keyConfigured: false, apiKeyMasked: '' });
  });
});
