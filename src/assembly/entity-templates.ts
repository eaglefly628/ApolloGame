// Pure entity template/repeat expansion, shared by manifest loading and asset discovery.
const TPL_WHOLE = /^\{\{\s*(i|item\.([A-Za-z0-9_-]+)|([A-Za-z0-9_-]+))\s*\}\}$/;
const TPL_ANY = /\{\{\s*(i|item\.([A-Za-z0-9_-]+)|([A-Za-z0-9_-]+))\s*\}\}/g;

type Scalar = string | number | boolean;
interface Subst { params: Record<string, unknown>; i?: number; item?: Record<string, unknown> }

function lookupTpl(name: string, itemField: string | undefined, paramName: string | undefined, sb: Subst): unknown {
  if (name === 'i') return sb.i;
  if (itemField !== undefined) return sb.item?.[itemField];
  return paramName !== undefined ? sb.params[paramName] : undefined;
}

/** 深代入 `{{…}}`：整串恰为一个占位符 → 原类型；含占位符 → 拼接（缺 → 空串）；对象/数组递归。 */
export function substituteTemplate(v: unknown, sb: Subst): unknown {
  if (typeof v === 'string') {
    const w = TPL_WHOLE.exec(v);
    if (w) { const r = lookupTpl(w[1], w[2], w[3], sb); return r === undefined ? '' : r; }
    return v.replace(TPL_ANY, (_m, name: string, itemField?: string, paramName?: string) => {
      const r = lookupTpl(name, itemField, paramName, sb);
      return r === undefined ? '' : String(r as Scalar);
    });
  }
  if (Array.isArray(v)) return v.map((x) => substituteTemplate(x, sb));
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = substituteTemplate(x, sb);
    return out;
  }
  return v;
}

/** 一个实体条目（可能带 $template/$params）→ 组件表：模板代入后，条目自带的组件键做**组件级**覆盖（同名组件整体替换）。 */
function materialize(entry: Record<string, unknown>, templates: Record<string, Record<string, unknown>>, sb: Subst, eid: string): Record<string, unknown> {
  const { $template, $params, $repeat: _r, ...overrides } = entry as { $template?: unknown; $params?: unknown; $repeat?: unknown } & Record<string, unknown>;
  let comps: Record<string, unknown> = {};
  if ($template !== undefined) {
    if (typeof $template !== 'string') fail(`实体 "${eid}" 的 $template 须是模板名字符串`);
    const tpl = templates[$template];
    if (!tpl) fail(`实体 "${eid}" 引用了不存在的模板 "${$template}"（已定义：${Object.keys(templates).join(', ') || '无'}）`);
    const params = { ...sb.params, ...(typeof $params === 'object' && $params !== null ? ($params as Record<string, unknown>) : {}) };
    comps = substituteTemplate(tpl, { ...sb, params: substituteTemplate(params, sb) as Record<string, unknown> }) as Record<string, unknown>;
  }
  for (const [k, v] of Object.entries(overrides)) comps[k] = substituteTemplate(v, sb);
  return comps;
}

/** 展开 templates / $template / $params / $repeat → 普通 entities。无这些键时逐字原样返回（零回归）。 */
export function expandEntities(raw: Record<string, unknown>): Record<string, unknown> {
  const templates = (typeof raw.templates === 'object' && raw.templates !== null ? raw.templates : {}) as Record<string, Record<string, unknown>>;
  const src = raw.entities as Record<string, unknown>;
  // 无原型的累积对象：`__proto__` 这类保留名会照常成为**自有属性**（普通对象上是改原型 → 条目静默蒸发），
  // 留给下游的 isUnsafeKey 检查大声拒收（fail-closed 不变）。
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [eidPat, entry] of Object.entries(src)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) { out[eidPat] = entry; continue; }
    const e = entry as Record<string, unknown>;
    const rep = e.$repeat as { count?: unknown; items?: unknown } | undefined;
    if (rep === undefined) {
      if (!('$template' in e)) { out[eidPat] = entry; continue; } // 普通实体：不动
      out[eidPat] = materialize(e, templates, { params: {} }, eidPat);
      continue;
    }
    const items: Array<Record<string, unknown>> = Array.isArray(rep.items)
      ? (rep.items as Array<Record<string, unknown>>)
      : typeof rep.count === 'number' && rep.count >= 0 ? Array.from({ length: rep.count }, () => ({})) : fail(`实体 "${eidPat}" 的 $repeat 须是 { count: N } 或 { items: [...] }`);
    items.forEach((item, i) => {
      const sb: Subst = { params: {}, i, item };
      const eid = String(substituteTemplate(eidPat, sb));
      if (eid in out) fail(`$repeat 展开出重复实体 id "${eid}"（模式 "${eidPat}" 请含 {{i}} 或 {{item.字段}}）`);
      out[eid] = materialize(e, templates, sb, eid);
    });
  }
  return out;
}

function fail(message: string): never { throw new Error(`manifest: ${message}`); }
