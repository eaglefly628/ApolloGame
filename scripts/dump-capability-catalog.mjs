#!/usr/bin/env node
// scripts/dump-capability-catalog.mjs —— 把引擎全量能力目录（buildCapabilityCatalog(ALL_CAPABILITIES)）
// 打到 stdout。=前端生成请求里送给 apollo.py 的那份 catalog 的服务端 parity。
// 用途：①排障看词表体量（全量 vs 题材子集的 token 预算）②给 studio-lowmodel-smoke.py 喂真 catalog。
// 用法：npx vite-node scripts/dump-capability-catalog.mjs
import { buildCapabilityCatalog } from '../src/assembly/capability-catalog.ts';
import { ALL_CAPABILITIES } from '../src/assembly/capability-registry.ts';
process.stdout.write(buildCapabilityCatalog(ALL_CAPABILITIES));
