// scripts/bundle-python-mac.mjs 纯函数单测（platform-packaging-spec.md D5）。
// 只钉「从 release 资产列表里挑出正确 tarball」这条匹配/报错逻辑——不联网、不下载、不解压，
// 用假资产数组模拟 GitHub API 返回，在 Linux/CI 上就能跑通并覆盖住。真下载/解压/pip install
// 那段（main() 里 darwin-only 分支）只有 mac CI 跑得到，见 .github/workflows/build-platform-mac.yml。
import { describe, it, expect } from 'vitest';
import { assetRegex, pickAsset } from './bundle-python-mac.mjs';

function asset(name) { return { name, browser_download_url: `https://example.invalid/${name}` }; }

describe('assetRegex · 资产文件名匹配规则', () => {
  it('匹配 python-build-standalone 的标准命名', () => {
    const re = assetRegex('3.11', '20250626');
    expect(re.test('cpython-3.11.13+20250626-aarch64-apple-darwin-install_only.tar.gz')).toBe(true);
  });

  it('不匹配其他系列/其他 tag/其他架构', () => {
    const re = assetRegex('3.11', '20250626');
    expect(re.test('cpython-3.10.18+20250626-aarch64-apple-darwin-install_only.tar.gz')).toBe(false);
    expect(re.test('cpython-3.11.13+20240101-aarch64-apple-darwin-install_only.tar.gz')).toBe(false);
    expect(re.test('cpython-3.11.13+20250626-x86_64-apple-darwin-install_only.tar.gz')).toBe(false);
    expect(re.test('cpython-3.11.13+20250626-aarch64-apple-darwin-install_only.tar.gz.sha256')).toBe(false);
  });

  it('系列/tag 里的 "." 是字面量而不是通配符（防误匹配，如 3x11）', () => {
    const re = assetRegex('3.11', '20250626');
    expect(re.test('cpython-3x11.13+20250626-aarch64-apple-darwin-install_only.tar.gz')).toBe(false);
  });
});

describe('pickAsset · 从资产列表挑恰好一个匹配项', () => {
  const fixtureAssets = [
    asset('cpython-3.10.18+20250626-aarch64-apple-darwin-install_only.tar.gz'),
    asset('cpython-3.10.18+20250626-aarch64-apple-darwin-install_only.tar.gz.sha256'),
    asset('cpython-3.11.13+20250626-aarch64-apple-darwin-install_only.tar.gz'),
    asset('cpython-3.11.13+20250626-aarch64-apple-darwin-install_only.tar.gz.sha256'),
    asset('cpython-3.11.13+20250626-x86_64-apple-darwin-install_only.tar.gz'),
    asset('cpython-3.12.4+20250626-aarch64-apple-darwin-install_only.tar.gz'),
  ];

  it('多系列混杂在同一 release 里也能精确挑中目标系列', () => {
    const hit = pickAsset(fixtureAssets, '3.11', '20250626');
    expect(hit.name).toBe('cpython-3.11.13+20250626-aarch64-apple-darwin-install_only.tar.gz');
  });

  it('目标系列在这个 tag 下不存在 → 抛出可读错误（不是静默 undefined）', () => {
    expect(() => pickAsset(fixtureAssets, '3.13', '20250626')).toThrow(/未在 release/);
  });

  it('目标 tag 不存在（空资产列表）→ 抛出可读错误', () => {
    expect(() => pickAsset([], '3.11', '20250626')).toThrow(/未在 release/);
  });

  it('命名规则万一改到能匹配出多个 → 抛出错误而不是随便挑一个', () => {
    const dup = [
      asset('cpython-3.11.13+20250626-aarch64-apple-darwin-install_only.tar.gz'),
      asset('cpython-3.11.14+20250626-aarch64-apple-darwin-install_only.tar.gz'),
    ];
    expect(() => pickAsset(dup, '3.11', '20250626')).toThrow(/匹配到 2 个资产/);
  });
});
