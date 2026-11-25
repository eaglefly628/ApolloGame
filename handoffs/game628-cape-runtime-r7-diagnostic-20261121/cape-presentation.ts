import type { IWorld } from '@engine/core/types.js';
import type { Cloth3D, ClothCollider3D, Resource } from '@engine/protocol/components.js';
import { readCapeRequest } from './cape-request.js';
import { CapeBudgetPolicy } from './inputs/budget-policy.mjs';
import profiles from './inputs/cloth-profiles.json';

const panelId = 'cape-preview-cloth';
const proxyId = (id: string) => `cape-preview-proxy-${id}`;
type Request = NonNullable<ReturnType<typeof readCapeRequest>>;
type Tier = 'normal' | 'low' | 'off';
type Status = 'unfitted' | 'dressed' | 'preparing' | 'undressed' | 'off' | 'degraded-low' | 'degraded-off' | 'unavailable';

export class CapePresentation {
  // The public renderer statistic measures the full preview CPU path. Leave headroom for
  // UI and input at 60 Hz; this does not implement the per-cloth 0.75 ms target.
  private readonly budget = new CapeBudgetPolicy({
    normalBudgetMs: 12, lowBudgetMs: 16.7, hardBudgetMs: 75,
  });
  private installed?: { avatarId: string; tier: Tier };
  private lastRequest?: Request;
  private proxyIds: string[] = [];
  private generation = 0;
  private settledFrames = 0;
  private tierRevision = 0;
  private runtimeReady = false;
  private hasProfile = false;

  constructor(private readonly world: IWorld, private readonly actorBodies: Readonly<Record<string, string>>, runtimeReady: boolean) {
    this.runtimeReady = runtimeReady;
  }

  private clean() {
    if (!this.installed) return;
    this.world.removeComponent(panelId, 'Cloth3D');
    for (const id of this.proxyIds) this.world.removeComponent(id, 'ClothCollider3D');
    this.proxyIds = [];
    this.installed = undefined;
    console.info('[cape-editor:transition]', 'removed');
  }

  update(renderWorld: IWorld) {
    const request = readCapeRequest(renderWorld, this.actorBodies);
    if (!request) {
      this.clean();
      return;
    }
    const previous = this.lastRequest;
    const revision = renderWorld.getComponent<Resource>('cape-tier-revision', 'Resource')?.current ?? 0;
    if (!previous || request.requestedTier !== previous.requestedTier || request.enabled !== previous.enabled || revision !== this.tierRevision) {
      this.budget.request(request.requestedTier);
      this.settledFrames = 0;
    }
    this.tierRevision = revision;
    this.lastRequest = request;
    const profile = profiles.body[request.bodyId as keyof typeof profiles.body];
    this.hasProfile = Boolean(profile);

    const tier = this.budget.tier as Tier;
    const quality = profile?.qualityByTier[tier];
    if (!this.runtimeReady || !request.enabled || !quality) {
      this.clean();
      return;
    }
    if (this.installed?.avatarId === request.avatarId && this.installed.tier === tier) return;
    this.clean();
    this.generation++;
    this.settledFrames = 0;

    const { left, right, maxStepMeters } = profile.attachment;
    const binding = (side: { node: string; offsetM: number[] }) => ({
      node: side.node, offsetM: side.offsetM as [number, number, number],
    });
    this.world.addComponent(panelId, {
      type: 'Cloth3D',
      width: profile.widthM, height: profile.heightM, pins: 'topCorners', style: 'plain',
      fabric: 'velvet', color: profiles.material.color, wind: profiles.cloth.wind,
      quality: quality.quality as Cloth3D['quality'], iterations: quality.iterations,
      attachment: {
        avatarId: request.avatarId, generation: this.generation, left: binding(left), right: binding(right), maxStepMeters,
      },
    } satisfies Cloth3D);
    for (const proxy of profile.proxyBindings) {
      const entity = proxyId(proxy.id);
      this.world.addComponent(entity, {
        type: 'ClothCollider3D', shape: proxy.shape as ClothCollider3D['shape'],
        radius: proxy.radius, halfHeight: proxy.halfHeight,
        attachment: { avatarId: request.avatarId, ...binding(proxy.attachment) },
      } satisfies ClothCollider3D);
      this.proxyIds.push(entity);
    }
    this.installed = { avatarId: request.avatarId, tier };
    console.info('[cape-editor:transition]', request.bodyId, tier, this.generation);
  }

  reportFrame(modelCount: number, previewCpuMs: number) {
    if (!this.installed || modelCount !== 1) return;
    // Do not count native creation and warm-up toward sustained budget limits.
    this.settledFrames++;
    if (this.settledFrames <= 12) return;
    const result = this.budget.sample(previewCpuMs);
    if (result.changed) console.info('[cape-editor:decision]', result.tier, result.reason);
  }

  get status(): Status {
    if (!this.runtimeReady) return 'unavailable';
    if (!this.lastRequest?.enabled) return this.hasProfile ? 'undressed' : 'unfitted';
    if (!this.hasProfile) return 'unfitted';
    if (this.budget.reason !== 'requested' && this.budget.tier !== this.lastRequest.requestedTier) {
      return this.budget.tier === 'off' ? 'degraded-off' : 'degraded-low';
    }
    if (this.budget.tier === 'off') return 'off';
    return this.installed ? 'dressed' : 'preparing';
  }

  read() {
    return { request: this.lastRequest, status: this.status, activeTier: this.installed?.tier,
      effectiveTier: this.budget.tier, reason: this.budget.reason, generation: this.generation };
  }
}
