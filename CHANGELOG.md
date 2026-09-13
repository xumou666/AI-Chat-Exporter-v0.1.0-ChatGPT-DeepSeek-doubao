# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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

[0.1.0]: https://github.com/<你的用户名>/<仓库名>/releases/tag/v0.1.0
