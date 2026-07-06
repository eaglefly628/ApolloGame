// Anim3D（程序化位姿动画·render-only）：纯函数求值 + 系统按壁钟改 Transform3D 分量 + 不进 hash。
import { describe, it, expect } from 'vitest';
import { Anim3DSystem } from './anim3d.js';
import { anim3dField } from '../three-projection.js';
import { World } from '@engine/core/world.js';
import { hashSnapshot } from '@net/index.js';
import type { Anim3D, Transform3D } from '@engine/protocol/components.js';

describe('anim3dField（纯函数·spin/bob）', () => {
  it('spin：field = 初值 + rate·t（匀速自转）', () => {
    expect(anim3dField({ kind: 'spin', rate: 0.36 }, 0, 0.7)).toBeCloseTo(0.7);
    expect(anim3dField({ kind: 'spin', rate: 0.36 }, 2, 0.7)).toBeCloseTo(0.7 + 0.72); // 1.42
  });
  it('bob：field = 初值 + amp·sin(t·freq + phase)（正弦浮动）', () => {
    expect(anim3dField({ kind: 'bob', amp: 0.13, freq: 1.8 }, 0, 0.78)).toBeCloseTo(0.78); // sin0=0
    // t·freq+phase = π/2 → sin=1 → 峰值 base+amp
    const tPeak = Math.PI / 2 / 1.8;
    expect(anim3dField({ kind: 'bob', amp: 0.13, freq: 1.8 }, tPeak, 0.78)).toBeCloseTo(0.78 + 0.13);
  });
});

describe('Anim3DSystem（据壁钟改 Transform3D·render-only）', () => {
  const mk = (): World => {
    const w = new World();
    w.createEntity('g');
    w.addComponent('g', { type: 'Transform3D', x: 0, y: 0.78, z: 0, rotY: 0.7 } as Transform3D);
    w.addComponent('g', { type: 'Anim3D', channels: [
      { kind: 'spin', field: 'rotY', rate: 0.36 }, { kind: 'bob', field: 'y', amp: 0.13, freq: 1.8 },
    ] } as Anim3D);
    return w;
  };

  it('spin 随经过秒推进 rotY（首见捕获初值·帧率无关·无累积漂移）', () => {
    const w = mk();
    const sys = new Anim3DSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('g', 'Transform3D')!;
    expect(sys.sync(w, 1000)).toBe(1); // 首帧捕获 base(rotY0.7)·tSec0 → rotY 仍 0.7
    expect(t().rotY).toBeCloseTo(0.7);
    sys.sync(w, 2000); // tSec 1 → 0.7 + 0.36
    expect(t().rotY).toBeCloseTo(1.06);
    sys.sync(w, 3000); // tSec 2 → 0.7 + 0.72（按初值算·非累加）
    expect(t().rotY).toBeCloseTo(1.42);
  });

  it('bob 绕 y 初值正弦摆（不漂移）', () => {
    const w = mk();
    const sys = new Anim3DSystem();
    const t = (): Transform3D => w.getComponent<Transform3D>('g', 'Transform3D')!;
    sys.sync(w, 1000); // tSec0 → y = 0.78
    expect(t().y).toBeCloseTo(0.78);
    const tPeakMs = 1000 + (Math.PI / 2 / 1.8) * 1000;
    sys.sync(w, tPeakMs); // 峰值 → 0.78 + 0.13
    expect(t().y).toBeCloseTo(0.78 + 0.13);
  });

  it('同 field 多通道叠加（compose·非覆盖）→ spin+bob 同 rotY = 变速自转（REQ-3D-骰盅 P18 下沉）', () => {
    const w = new World();
    w.createEntity('d');
    w.addComponent('d', { type: 'Transform3D', x: 0, y: 0, z: 0, rotY: 0.5 } as Transform3D);
    w.addComponent('d', { type: 'Anim3D', channels: [
      { kind: 'spin', field: 'rotY', rate: 1.0 }, { kind: 'bob', field: 'rotY', amp: 0.4, freq: 2.0 },
    ] } as Anim3D);
    const sys = new Anim3DSystem();
    const rotY = (): number => w.getComponent<Transform3D>('d', 'Transform3D')!.rotY!;
    sys.sync(w, 1000); // base 捕获·tSec0：spin delta 0 + bob delta 0 → 0.5
    expect(rotY()).toBeCloseTo(0.5);
    sys.sync(w, 2000); // tSec1：0.5 + spin(1.0·1) + bob(0.4·sin2) = 0.5 + 1.0 + 0.4·sin(2)
    expect(rotY()).toBeCloseTo(0.5 + 1.0 + 0.4 * Math.sin(2)); // 叠加·非覆盖（旧行为=后通道覆盖=只 bob）
  });

  it('空场返回 0；实体消失后清理动画态（流式卸载安全）', () => {
    const sys = new Anim3DSystem();
    const empty = new World();
    expect(sys.sync(empty, 16)).toBe(0);
    const w = mk();
    expect(sys.sync(w, 1000)).toBe(1);
    w.destroyEntity('g');
    expect(sys.sync(w, 2000)).toBe(0); // 无实体 → 0·态已清
  });
});

describe('Anim3D 是 render-only（不进 hash）', () => {
  it('挂 Anim3D 不改变快照哈希', () => {
    const w = new World();
    w.createEntity('g');
    const h0 = hashSnapshot(w.snapshot());
    w.addComponent('g', { type: 'Anim3D', channels: [{ kind: 'spin', field: 'rotY', rate: 1 }] } as Anim3D);
    expect(hashSnapshot(w.snapshot())).toBe(h0); // Anim3D 不进 hash
  });
});
