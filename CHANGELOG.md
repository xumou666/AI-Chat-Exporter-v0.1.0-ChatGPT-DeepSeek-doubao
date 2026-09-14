# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.1] — 2026-09-13

文档与发布工程更新，导出行为无破坏性变化。

### 新增

- **完整中文使用教程**：[docs/使用教程.md](docs/使用教程.md)，17 节：安装、五种格式取舍、部分导出、图片打包、PDF、可选内容、文件名模板、站点改版恢复、长对话、进阶用法、FAQ、控件速查表。
- **文档截图**：`docs/images/` 四张真实界面截图，由 `npm run screenshots` 调用本机 Chrome / Edge 生成。
- **Release 打包**：`npm run package` 产出 `dist/ai-chat-exporter-<version>.zip`（复用扩展自研的 ZIP 写入器，可直接加载或作为 Release 附件）。
- **自动发布**：推送 `v*` 标签后，GitHub Actions 自动跑测试、打包扩展并创建带 ZIP 附件的 Release（`.github/workflows/release.yml`）。
- **版本一致性校验**：测试确保 `manifest.json`、`package.json`、`src/core/schema.js` 与 `CHANGELOG.md` 的版本号一致。
- **演示页深链接**：`demo/index.html#panel`、`#range=2-4`、`#diag`；新增 `demo/ui-preview.html` 同步渲染面板，供截图与 UI 预览。

### 修复

- 演示页与自检页未引入 `panel.css`，浏览器中直接打开时面板没有样式。
- PDF / HTML 导出中的块级公式显示为 `$$ … $$` 原文，现改为居中排版，行内 `$…$` 同步处理。
- 页面本身几乎没有消息时，导出器自身的面板 DOM 可能被识别为会话内容，现已在行发现、可用行判断与校准规则匹配处排除。

### 改进

- 面板「指定范围」在序号旁实时显示该条消息的角色与开头文字，越界标红并按实际可导出范围夹取。
- 结构诊断新增「清除已学习结构」入口。
- 测试规模 53 → 59 项（新增文档链接一致性、版本一致性、公式渲染、面板范围预览等用例）。

## [0.1.0] — 2026-09-13

首个可用版本。

### 新增

- **多站点支持**：ChatGPT（chatgpt.com / chat.openai.com）、DeepSeek（chat.deepseek.com）、豆包（doubao.com），
  另有通用适配器可作用于其它聊天页面（工具栏图标按需注入）。
- **五种导出格式**：Markdown（YAML front matter + 目录）、JSON（版本化 schema）、PDF（A4 打印页）、HTML（自包含）、纯文本。
- **部分导出**：起止序号选择，序号旁实时显示该条消息的角色与开头文字；越界自动夹取；导出后重新编号。
- **图片打包**：勾选后把文档与 `images/` 一起打成 ZIP，文内图片链接改写为相对路径。
- **富文本保真**：代码块（语言标注）、表格、列表、引用、KaTeX/MathJax 公式（行内与块级）、链接、`<details>` 折叠块。
- **可选内容**：思考过程、工具调用、参考链接、消息时间戳。
- **手动校准**：站点改版时点击一条用户消息 + 一条助手消息即可学习页面结构，规则按站点保存在本地。
- **结构诊断**：面板内展示识别策略、候选行签名、角色置信度与告警；支持清除已学习结构。
- **多语言界面**：简体中文 / English，按浏览器语言自动选择。
- **文件名模板**：`{platform}` `{platformLabel}` `{title}` `{date}` `{id}` `{model}` `{count}`，自动净化非法字符。

### 工程

- **零运行时依赖**：HTML→Markdown 转换、ZIP 写入（store + UTF-8 名 + CRC32）、打印文档渲染全部自研。
- **58 项 jsdom 测试**：三站点夹具提取、序列化、ZIP 互通、打印文档、校准规则、面板与部分导出、文档链接、manifest 打包一致性。
- **浏览器内自检**：`demo/selftest.html` 在真实 Chromium 中运行 10 项检查。
- **可复现产物**：`npm run examples` 生成导出样例，`npm run screenshots` 生成文档截图，`npm run package` 生成 Release ZIP。
- **隐私优先**：不申请 `<all_urls>`，不发送任何数据到服务器。

[0.1.1]: https://github.com/xumou666/AI-Chat-Exporter-v0.1.0-ChatGPT-DeepSeek-doubao/releases/tag/v0.1.1
[0.1.0]: https://github.com/xumou666/AI-Chat-Exporter-v0.1.0-ChatGPT-DeepSeek-doubao/releases/tag/v0.1.0
