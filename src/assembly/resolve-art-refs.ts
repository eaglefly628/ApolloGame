import { rankRecords, type LibraryRecord } from '@assets/index.js';

// ═══════════════════════════════════════════════════════════════
//  art: 引用解析 —— 让 AI「合理选择素材」的数据驱动机制。
//
//  LLM 在 manifest 里把任何贴图字段写成 "art:<英文关键词>"（如 "art:skeleton warrior"、
//  "art:floor grass"），本模块在加载前把它替换成素材库里**确定性排序最优**的真实资产 id。
//
//  宣言尺子：LLM 产出的只是一个查询字符串（最弱的 LLM 也写得出），选材本身发生在
//  引擎这台固定解释器里（rankRecords：与资源库浏览器搜索同一个排序器——所见即所选）；
//  同一份 manifest + 同一份素材索引 → 永远解析出同一张图，可审计（resolutions 留痕）。
//
//  纯函数、不改输入；解析失败的引用原样保留（渲染层退化占位，不炸加载）。
// ═══════════════════════════════════════════════════════════════

export const ART_REF_PREFIX = 'art:';

export interface ArtResolution {
  readonly entity: string;
  readonly component: string;
  readonly field: string;
  readonly query: string;
  /** 解析结果 id；素材库无任何命中时为 null（字段原样保留）。 */
  readonly id: string | null;
  readonly score: number;
  /** 前 3 名候选（审计/调试用）。 */
  readonly candidates: readonly string[];
}

export interface ResolveArtResult {
  /** 替换完成的新 manifest（输入未被修改）。 */
  readonly manifest: unknown;
  readonly resolutions: readonly ArtResolution[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 遍历 raw manifest 的 entities.*.<Comp>.<field>，把 "art:<query>" 字符串解析为素材 id。 */
export function resolveArtRefs(raw: unknown, records: readonly LibraryRecord[]): ResolveArtResult {
  if (!isObj(raw) || !isObj(raw.entities)) return { manifest: raw, resolutions: [] };

  const resolutions: ArtResolution[] = [];
  let entitiesChanged = false;
  const newEntities: Record<string, unknown> = {};

  for (const [eid, comps] of Object.entries(raw.entities)) {
    if (!isObj(comps)) {
      newEntities[eid] = comps;
      continue;
    }
    let compChanged = false;
    const newComps: Record<string, unknown> = {};
    for (const [cname, data] of Object.entries(comps)) {
      if (!isObj(data)) {
        newComps[cname] = data;
        continue;
      }
      let fieldChanged = false;
      const newData: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.startsWith(ART_REF_PREFIX)) {
          const query = value.slice(ART_REF_PREFIX.length).trim();
          const ranked = query ? rankRecords(records, query) : [];
          const top = ranked[0];
          resolutions.push({
            entity: eid,
            component: cname,
            field,
            query,
            id: top ? top.record.id : null,
            score: top?.score ?? 0,
            candidates: ranked.slice(0, 3).map((x) => x.record.id),
          });
          if (top) {
            newData[field] = top.record.id;
            fieldChanged = true;
            continue;
          }
        }
        newData[field] = value;
      }
      newComps[cname] = fieldChanged ? newData : data;
      compChanged ||= fieldChanged;
    }
    newEntities[eid] = compChanged ? newComps : comps;
    entitiesChanged ||= compChanged;
  }

  const manifest = entitiesChanged ? { ...raw, entities: newEntities } : raw;
  return { manifest, resolutions };
}
