#!/usr/bin/env node
// REQ-AIFLOW-DSYNC（U1）CLI：导出 Claude Design 设计系统包（缺省 dist/design-system/）。
// 用法：npx vite-node scripts/design-system-export.mjs [--out <dir>]
// 之后由 owner 在会话里启动 /design-sync，把该目录推到 Claude Design 的设计系统项目。
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeDesignSystemPack } from './lib/design-system-pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--out');
writeDesignSystemPack(resolve(i >= 0 ? process.argv[i + 1] : join(ROOT, 'dist', 'design-system')));
