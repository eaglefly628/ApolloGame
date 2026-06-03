# UI 主题化模块知识

> 覆盖：多风格主题系统、CSS tokens、主题切换、AI 生成主题

## 核心原则

- UI 结构和视觉风格分离：组件的 HTML/JSX 结构固定，CSS 由主题包决定。
- 所有视觉属性通过 CSS 自定义属性（`--theme-*`）传递，切换主题 = 换一组变量值。
- 每套主题是一个完整统一的视觉套装 — 不是单个组件换色，是整套 UI 风格一致。

## 主题架构

```
ThemeTokens (色板 + 排版 + 形状)
      ↓
  tokens.css (CSS 自定义属性)
      ↓
  components/*.css (读取 --theme-* 变量)
      ↓
  React 组件 (className 引用)
```

### CSS Tokens 示例

```css
:root {
  --theme-bg: #0f172a;
  --theme-text: #e2e8f0;
  --theme-accent: #38bdf8;
  --theme-border: #334155;
  --theme-radius: 6px;
  --theme-font: system-ui, sans-serif;
  --theme-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
```

### 组件引用 Tokens

```css
.panel {
  background: var(--theme-bg);
  color: var(--theme-text);
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius);
  box-shadow: var(--theme-shadow);
  font-family: var(--theme-font);
}
```

## 主题切换

### 运行时切换
```typescript
function applyTheme(themeName: string) {
  document.documentElement.setAttribute('data-theme', themeName);
}
// CSS 通过 [data-theme="cyberpunk"] 选择器切换变量
```

### 构建时切换
```typescript
// 按需 import
import(`./themes/${themeName}/tokens.css`);
```

## 20 个标准组件

核心（10）：health-bar, button, panel, dialog, menu, notification, progress-bar, tooltip, label, icon-badge

扩展（10）：inventory, skill-slot, mini-map, avatar-frame, name-plate, choice-option, tab-bar, slider, modal, toast

所有主题必须实现核心 10 个，扩展按游戏类型选做。

## 8 套预设主题

| 主题 | 适合 | 核心特效 |
|------|------|---------|
| minimal-dark | 通用 | 无特效，纯色 + 线条 |
| cyberpunk | 科幻/动作 | 霓虹发光 + 故障闪烁 |
| pixel-retro | 复古/独立 | 像素边框 + CRT 扫描线 |
| ink-wash | 国风/武侠 | 宣纸纹理 + 墨色渐变 |
| sakura-otome | 乙游/恋爱 | 柔光 + 花瓣装饰 |
| fantasy-medieval | RPG/冒险 | 石纹木纹 + 铆钉 |
| sci-fi-hologram | 太空/策略 | 全息透明 + 扫描动画 |
| glassmorphism | 休闲/社交 | 毛玻璃 + 渐变边框 |

## AI 生成主题的工作流

1. **需求描述**：用户说"我要一个蒸汽朋克风格的 UI"
2. **读取基础模板**：读 theme.types.ts 的接口定义
3. **Claude 生成 spec.md**：色板 + 排版 + 特效定义
4. **Claude 生成 tokens.css**：CSS 自定义属性
5. **Claude 生成 components/*.css**：每个组件的样式
6. **Claude Design 生成素材**：纹理贴图、装饰图案、边框素材
7. **集成测试**：加载主题，检查所有组件视觉一致

## 自定义主题（用户/作者创建）

- 最简方式：复制 minimal-dark，修改 tokens.css 里的色值。
- 进阶方式：写新的 spec.md，让 Claude 根据 spec 生成全套组件。
- 发布方式：主题包可以独立分发（一个目录 = 一套主题）。

## 响应式适配

- 主题的 token 可以按屏幕尺寸变化：
  ```css
  @media (max-width: 480px) {
    :root { --theme-radius: 8px; --theme-font-size: 14px; }
  }
  ```
- 移动端：增大触摸目标（按钮最小 44×44px）、减少装饰元素。

## 无障碍（Accessibility）

- 每套主题必须满足 WCAG 2.1 AA 对比度标准（文字:背景 ≥ 4.5:1）。
- 提供 high-contrast 变体或 `prefers-contrast: more` 媒体查询。
- 动画尊重 `prefers-reduced-motion: reduce` — 减弱或关闭。
- 色盲模式：danger/success 不仅靠颜色区分，还用图标或形状。

## 常见陷阱

- 毛玻璃（backdrop-filter）在低端安卓设备性能差 — 提供 fallback 纯色背景。
- 自定义字体加载慢 — 先显示系统字体，字体加载完后切换（FOUT 优于 FOIT）。
- 深色主题上的图片：暗色背景下亮色图片太刺眼 — 加 brightness(0.8) filter。
- 主题切换时的闪烁：先加载新主题 CSS，再移除旧的。或用 CSS Layer 层叠控制。

## 前沿技术

- **CSS @layer**：分层 CSS，主题层的样式优先级可控。
- **CSS color-mix()**：运行时混合颜色，一个 accent 色自动派生 hover/active 变体。
- **CSS relative color syntax**：`oklch(from var(--accent) l c h / 50%)` 动态调透明度。
- **View Transition API**：主题切换时添加过渡动画。
- **CSS Container Queries**：组件级响应式，不依赖窗口宽度。

## 参考来源

- src/ui/themes/README.md — 主题系统目录结构和组件命名规范
- src/ui/themes/theme.types.ts — 主题 TypeScript 接口定义
- 各主题 spec.md — 8 套预设主题的风格定义和生成 prompt
