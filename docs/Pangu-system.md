# Pangu 自定义样式指南

Pangu 组件库采用 **无侵入式 BEM 命名** + **语义化 data-* 钩子** 的设计策略。所有组件 DOM 结构上均预置了固定的 `pangu-*` 类名与扩展属性，允许开发者在不修改组件源码的前提下，自由覆盖样式、适配品牌主题或实现深色模式。

---

## 1. 设计原则

- **完全无样式依赖**  
  组件内部不携带任何强制外观（除极少数布局必需的 `flex`, `overflow` 等），所有视觉效果均可被外部样式覆盖。
- **BEM 命名规范**  
  所有自定义类名遵循 `pangu-[block]__[element]--[modifier]` 的简化形式，确保低冲突、高语义。
- **钩子驱动**  
  通过 `data-theme`、`data-ext`、`data-状态` 等属性暴露上下文，方便开发者编写条件样式。
- **不入侵 JS 逻辑**  
  样式覆盖不会影响拖拽上传、预览弹窗、删除确认等交互行为。

---

## 2. 核心组件与样式钩子

以下列出所有可被外部样式引用的 **根容器类** 与 **关键子结构类**。

### 2.1 主仪表盘布局 `pangu-dashboard`

| 类名 | 说明 |
|------|------|
| `.pangu-dashboard` | 页面根容器，承载全局背景、文字色、主题属性 |
| `.pangu-toolbar` | 顶部操作栏（搜索框 + 上传组件 + 新建文件夹） |
| `.pangu-create-folder-form` | 新建文件夹的 `form` 元素 |
| `.pangu-explorer-breadcrumbs` | 面包屑导航容器 |
| `.pangu-breadcrumb-item` | 单个面包屑链接（如 `ROOT`） |
| `.pangu-breadcrumb-separator` | 分隔符（`/`） |
| `.pangu-breadcrumb-current` | 当前目录名 |

**示例 – 自定义面包屑颜色：**
```css
.pangu-breadcrumb-item {
  color: #f97316;
  font-weight: bold;
}
.pangu-breadcrumb-current {
  color: #1e293b;
  background: #f1f5f9;
  padding: 0 0.5rem;
  border-radius: 1rem;
}
```

### 2.2 上传组件 `Uploader`

| 类名 | 说明 |
|------|------|
| `.pangu-upload-container` | 上传按钮 + 进度条外层容器 |
| `.pangu-upload-input` | `<input type="file">` 元素 |
| `.pangu-status-container` | 进度条外壳（背景轨道） |
| `.pangu-status` | 进度条填充条 |
| `.pangu-status-text` | “传输中” 文字状态 |

### 2.3 文件/文件夹列表 `FileExplorer`

| 类名 | 说明 |
|------|------|
| `.pangu-explorer-container` | 整个表格容器（卡片 + 边框） |
| `.pangu-explorer-header` | 表头行（名称 / 大小 / 操作） |
| `.pangu-explorer-list` | 列表项的包裹容器 |
| `.pangu-explorer-folder-row` | 单个文件夹行 |
| `.pangu-explorer-file-row` | 单个文件行（携带 `data-ext` 属性） |
| `.pangu-row-icon` | 文件/文件夹前的 Emoji 图标 |
| `.pangu-folder-link` | 文件夹名称的 `<a>` 链接 |
| `.pangu-file-name` | 文件名文本（无链接） |
| `.pangu-file-size` | 文件大小列 |
| `.pangu-copy-btn` / `.pangu-download-btn` / `.pangu-delete-btn` | 操作按钮 |
| `.pangu-explorer-empty` | 空状态占位区域 |

**`data-ext` 支持的文件扩展名示例**  
文件行会自动添加 `data-ext="jpg"`, `data-ext="mp4"`, `data-ext="md"` 等，可基于此做差异化行样式：
```css
.pangu-explorer-file-row[data-ext="mp4"] {
  background-color: #fff7ed;
  border-left: 3px solid #f97316;
}
```

### 2.4 预览弹窗 `PreviewModal`

| 类名 | 说明 |
|------|------|
| `.pangu-modal-mask` | 全屏遮罩层，携带 `data-ext`（文件扩展名） |
| `.pangu-modal-body` | 弹窗卡片主体 |
| `.pangu-modal-header` | 头部栏（标题 + 关闭按钮） |
| `.pangu-modal-title` | 文件名标题 |
| `.pangu-modal-close-btn` | 关闭按钮（实际为 `<Link>`） |
| `.pangu-modal-content` | 滚动的内容区域 |

#### 各预览类型专用钩子

| 预览类型 | 钩子类名 |
|---------|----------|
| 图片 (jpg/png/gif/webp) | `.pangu-preview-image-wrapper`<br>`.pangu-preview-image` |
| 视频 (mp4/webm/mov) | `.pangu-preview-video-wrapper`<br>`.pangu-preview-video` |
| Markdown | `.pangu-preview-markdown-wrapper` |
| 代码文件 (js/ts/py/json等) | `.pangu-preview-code-wrapper`<br>内部细节见下方 CodePreviewer |
| Office 文档 (docx/pptx) | `.pangu-preview-office-iframe` |
| 纯文本 / CSV | `.pangu-preview-text-pre` |
| 音频 (mp3/wav/flac) | `.pangu-preview-audio-wrapper`<br>`.pangu-preview-audio-disc`<br>`.pangu-preview-audio-title`<br>`.pangu-preview-audio` |
| PDF（暂不支持） | `.pangu-preview-pdf-unsupported` |
| 其他格式 | `.pangu-preview-unsupported-wrapper`<br>`.pangu-preview-unsupported-download` |

### 2.5 代码预览器 `CodePreviewer`

| 类名 | 说明 |
|------|------|
| `.pangu-preview-code-wrapper` | 整个代码预览卡片容器 |
| `.pangu-preview-header` | 顶栏（状态点 + 行数统计） |
| `.pangu-code-body` | 代码滚动区域，截断时带 `.has-mask` |
| `.pangu-prism-sandbox` | SyntaxHighlighter 挂载容器 |
| `.pangu-preview-mask` | 截断提示蒙层（含 `.mask-text`, `.override-btn`） |

---

## 3. 全局属性钩子

| 属性名 | 值示例 | 使用场景 |
|--------|--------|----------|
| `data-theme` | `"default"`, `"dark"`, `"hacker"` | 挂载在 `.pangu-dashboard` 上，用于主题切换 |
| `data-ext` | `"mp4"`, `"pdf"`, `"js"` | 文件行或弹窗遮罩层，依据扩展名定制样式 |
| `disabled` | — | 删除按钮在上传/删除中时自动添加，可配合 `opacity`、`cursor` |

---

## 4. 主题定制最佳实践

### 4.1 通过 `data-theme` 切换主题

在根组件（或布局）中改变 `data-theme` 的值：

```tsx
// 业务代码中动态修改主题
document.documentElement.setAttribute('data-theme', 'dark');
// 或通过 Context 控制 .pangu-dashboard 的 data-theme
```

然后编写对应的 CSS：

```css
/* 默认浅色主题（无需 data-theme 选择器） */
.pangu-dashboard {
  background-color: #f9fafb;
  color: #111827;
}

/* 深色主题覆盖 */
[data-theme="dark"] .pangu-dashboard {
  background-color: #0f172a;
  color: #e2e8f0;
}

[data-theme="dark"] .pangu-toolbar {
  background-color: #1e293b;
  border-color: #334155;
}
```

### 4.2 使用 CSS 变量实现主题内可变属性

推荐定义少量 CSS 变量，一次性影响多个组件：

```css
.pangu-dashboard {
  --pangu-primary: #3b82f6;
  --pangu-primary-hover: #2563eb;
  --pangu-border: #e2e8f0;
  --pangu-card-bg: #ffffff;
}

[data-theme="dark"] .pangu-dashboard {
  --pangu-primary: #f97316;
  --pangu-primary-hover: #ea580c;
  --pangu-border: #334155;
  --pangu-card-bg: #1e293b;
}

.pangu-toolbar,
.pangu-explorer-container {
  background-color: var(--pangu-card-bg);
  border-color: var(--pangu-border);
}
```

---

## 5. 样式覆写注意事项

1. **不要使用 `!important`**  
   通过提高选择器权重（例如 `.pangu-dashboard .pangu-toolbar`）即可覆盖内联 Tailwind 工具类。

2. **避免破坏布局**  
   组件内部使用了 `grid`、`flex` 来保证行列对齐。覆盖 `display` 属性可能会导致错位，如无必要请不要修改 `grid` 布局。

3. **响应式适配**  
   部分组件（表头、操作列）已内置响应式类（`md:col-span-7`）。若有特殊需求，可覆盖不同断点下的栅格：

   ```css
   @media (max-width: 768px) {
     .pangu-explorer-header > div:first-child {
       grid-column: span 8;
     }
   }
   ```

4. **过渡动画**  
   默认在 hover、删除、复制等操作上带有轻微过渡，可按需调整 `transition` 属性或时长。

5. **安全区域**  
   弹窗遮罩层 `.pangu-modal-mask` 使用 `backdrop-filter: blur()`，若需兼容性可替换为半透明背景色。

---

## 6. 完整组件清单速查

| 组件 | 根类 | 主要子结构类数量 |
|------|------|----------------|
| 页面仪表盘 | `.pangu-dashboard` | 6 |
| 上传组件 | `.pangu-upload-container` | 4 |
| 文件浏览器 | `.pangu-explorer-container` | 12+ (含 file-row 扩展) |
| 预览弹窗 | `.pangu-modal-mask` | 8 + 预览类型钩子×12 |
| 代码预览器 | `.pangu-preview-code-wrapper` | 5 |

---

## 7. 附：典型的自定义样式示例

**目标**：将所有文件夹行背景设为浅绿色，文件行交替行斑马纹，删除按钮改为红色圆角胶囊。

```css
/* 文件夹行特殊标记 */
.pangu-explorer-folder-row {
  background-color: #f0fdf4;
  border-radius: 12px;
  margin-bottom: 4px;
}

/* 文件行斑马纹 */
.pangu-explorer-file-row:nth-child(even) {
  background-color: #f8fafc;
}
.pangu-explorer-file-row:nth-child(odd) {
  background-color: #ffffff;
}

/* 统一删除按钮胶囊样式 */
.pangu-delete-btn {
  background-color: #fee2e2;
  border-radius: 9999px;
  padding: 0.25rem 0.75rem;
  font-weight: 600;
  transition: all 0.2s;
}
.pangu-delete-btn:hover:not(:disabled) {
  background-color: #fecaca;
  transform: scale(1.02);
}
```

---

## 8. 调试建议

- 在浏览器开发者工具中搜索 `class="pangu-` 可以快速定位所有组件结构。
- 使用 `$('[data-ext]')` 观察当前文件类型属性值。
- 若要彻底重置某组件样式，可直接对该根类编写全量属性，组件本身不设防。

遵循本指南，您可以在不改动任何组件源码的前提下，实现从细微调整到完整主题替换的所有样式需求。