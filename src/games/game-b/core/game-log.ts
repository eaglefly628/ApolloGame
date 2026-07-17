// Game B ·《雀宴》—— 游戏日志（owner 2026-07-17「加游戏日志查 bug」）。
// 结构化事件收集器·headless（walkthrough dump 查 bug）+ UI（日志面板实时看）双消费。
// 纯数据·零随机·零 IO；局逻辑每步 push 一条，宿主/测试读。不进 sim hash（旁路观测）。

export type LogKind =
  | 'round' | 'deal' | 'draw' | 'discard' | 'tsumo' | 'ron' | 'ryuukyoku'
  | 'score' | 'riichi' | 'dora' | 'info';

export interface LogEvent {
  seq: number; // 全局递增序号
  round: string; // 局名（東1局）
  actor: string; // 行动者名（主角/绫/…/系统）
  kind: LogKind;
  text: string; // 人读描述
  tile?: number; // 涉及牌码（可选·查牌流）
}

export class GameLog {
  private evs: LogEvent[] = [];
  private n = 0;

  push(e: Omit<LogEvent, 'seq'>): void {
    this.evs.push({ seq: this.n++, ...e });
  }

  /** 最近 k 条（UI 日志面板·倒序展示由消费方定）。 */
  recent(k = 14): LogEvent[] {
    return this.evs.slice(-k);
  }

  all(): readonly LogEvent[] {
    return this.evs;
  }

  size(): number {
    return this.evs.length;
  }

  clear(): void {
    this.evs = [];
    this.n = 0;
  }

  /** headless 文本转储（walkthrough 失败时贴出查 bug）。 */
  dump(): string {
    return this.evs.map((e) => `#${e.seq} [${e.round}] ${e.actor} · ${e.kind} · ${e.text}`).join('\n');
  }
}
