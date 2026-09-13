# 贡献指南

感谢你愿意改进这个项目！下面是最短路径。

## 环境

- Node.js 20+（仅用于测试与工具脚本，扩展运行时不依赖 Node）
- Chrome / Edge 等 Chromium 浏览器（手动验证用）

```bash
npm install
npm test
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm test` | 运行全部 jsdom 测试（提交前必须通过） |
| `npm run examples` | 用夹具重新生成 `examples/` 导出样例 |
| `npm run screenshots` | 用本机 Chrome/Edge 重新生成 `docs/images/` 截图（`AICE_BROWSER` 可指定浏览器路径） |
| `npm run icons` | 重新生成 `assets/icon*.png` |
| `npm run package` | 生成 `dist/ai-chat-exporter-<version>.zip` |

## 代码风格

- `src/` 下都是**经典脚本**（不是 ES module），按 `manifest.json` 中的顺序加载，挂在
  `globalThis.AIChatExporter` 命名空间下（`core.*` / `platforms` / `ui`）。
  这样同一份代码既能作为内容脚本运行，也能在 jsdom 里被测试。
- **运行时不引入任何第三方依赖**；需要新能力时优先自己写小模块（参见 `zip.js`）。
- 核心逻辑（`src/core/*`）不要调用 `chrome.*`，浏览器相关的部分放在 `content.js` / `background.js`。
- 面向用户的文案走 `src/core/i18n.js`，中英文都要补齐。
- 新增可测逻辑时请同时补测试；测试文件放在 `tests/`，夹具放在 `tests/fixtures/`。

## 新增一个站点适配器

1. 新建 `src/platforms/<id>.js`，照抄 `chatgpt.js` 的结构，填写：
   - `id` / `label` / `hosts`（用于 `platforms.detect`）
   - `rowSelectors`（消息行选择器，能命中就优先用）
   - `contentSelectors`（消息正文容器）
   - `userPatterns` / `assistantPatterns` / `userTestIdPatterns` / `assistantTestIdPatterns`（角色线索）
   - `getMeta(doc, location)`（标题、会话 ID、模型）
2. 在 `manifest.json` 的 `host_permissions`、`content_scripts.matches` 与 `content_scripts.js` 中加入该文件；
   同时更新 `src/background.js` 的 `CONTENT_FILES`（顺序必须一致，`tests/manifest.test.js` 会校验）。
3. 在 `tests/fixtures/` 放一份脱敏后的页面 HTML（保留结构与属性，去掉真实内容），
   在 `tests/extraction.test.js` 增加断言（消息数、角色序列、代码块/表格等）。
4. 更新 `README.md` 的支持列表与 `CHANGELOG.md`。

## 提交 PR 前

- [ ] `npm test` 全绿（含 manifest 一致性检查）
- [ ] 改动了 UI → 重新跑 `npm run screenshots` 并提交 `docs/images/`
- [ ] 改动了导出格式 → 重新跑 `npm run examples` 并提交 `examples/`
- [ ] 面向用户的行为变化 → 更新 `README.md` 与 `CHANGELOG.md`
- [ ] 不引入运行时依赖（如确有必要请在 PR 里说明理由）

## 报告问题

请使用 issue 模板，并尽量附上：

1. 站点与页面地址形态（例如 `chat.deepseek.com/a/chat/s/...`）；
2. 面板底部**「结构诊断」**的文本（识别策略 + 候选行 + 置信度）；
3. 期望结果与实际结果（截图最好）；
4. 扩展版本与浏览器版本。

> 注意：请不要粘贴包含隐私内容的完整对话；诊断文本里的消息开头可按需打码。
