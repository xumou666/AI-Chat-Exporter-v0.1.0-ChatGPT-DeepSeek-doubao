# AI Chat Exporter

**一键把网页端 ChatGPT / DeepSeek / 豆包 的对话导出为 Markdown、JSON、PDF、HTML 或纯文本。**
纯本地运行的 Chrome / Edge 扩展（Manifest V3），无后端、无账号、无运行时依赖。

[![CI](https://github.com/xumou666/AI-Chat-Exporter-v0.1.0-ChatGPT-DeepSeek-doubao/actions/workflows/ci.yml/badge.svg)](https://github.com/xumou666/AI-Chat-Exporter-v0.1.0-ChatGPT-DeepSeek-doubao/actions/workflows/ci.yml)
![tests](https://img.shields.io/badge/tests-69%20passed-brightgreen)
![manifest](https://img.shields.io/badge/manifest-v3-blue)
![platform](https://img.shields.io/badge/Chrome%20%7C%20Edge-supported-blue)
![deps](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)
[![version](https://img.shields.io/badge/version-0.1.3-blue)](CHANGELOG.md)
![license](https://img.shields.io/badge/license-MIT-green)

<!--
维护提示（GitHub 上不显示这段注释）：
- 改动 UI 后跑 `npm run screenshots` 重新生成 docs/images/ 并提交。
- 改动导出结果后跑 `npm run examples` 重新生成 examples/ 并提交。
- 发版：改版本号 → `npm test` → 提交推送 → 打 tag `v<version>` 推送；GitHub Actions 会自动跑测试、打包扩展并创建 Release。
- 三个版本号必须同步：manifest.json / package.json / src/core/schema.js（由 npm test 校验）。
-->

<p align="center">
  <img src="docs/images/hero.png" alt="导出面板：格式、范围、选项、文件名模板" width="760">
</p>

<p align="center">
  <img src="docs/images/range-picker.png" alt="指定范围：序号旁显示该条消息的角色与开头文字" width="330">
  <img src="docs/images/diagnostics.png" alt="结构诊断：识别策略、候选行、角色置信度" width="330">
</p>

<p align="center"><sub>左：指定范围时序号旁实时显示消息开头 ｜ 右：结构诊断，能看清"识别到了哪几条、角色置信度如何"</sub></p>

---

## 目录

- [这是什么](#这是什么)
- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [使用教程](#使用教程)
- [导出格式怎么选](#导出格式怎么选)
- [导出样例](#导出样例)
- [工作原理](#工作原理)
- [常见问题](#常见问题)
- [已知限制](#已知限制)
- [开发与测试](#开发与测试)
- [目录结构](#目录结构)
- [更新日志](#更新日志)
- [隐私](#隐私)
- [许可与致谢](#许可与致谢)

## 这是什么

网页版的 ChatGPT / DeepSeek / 豆包 都没有好用的"把这段对话完整带走"的出口。这个扩展在页面右下角放一个按钮，
把一个会话（或你选中的部分）转换成**结构清晰、可以直接归档或分享**的文档：

- **Markdown**：带 YAML 元信息与目录，代码块保留语言，表格 / 列表 / 引用 / 公式都在
- **JSON**：结构化数据，含角色、时间、图片、引用、思考过程，方便二次加工
- **PDF**：A4 排版，走浏览器打印（另存为 PDF），无需第三方库
- **HTML / 纯文本**：自包含网页视图，或给不认 Markdown 的场景

内容方案参考了开源项目 [Z2IRIM/Chat-Exporter-for-Chatgpt-Website](https://github.com/Z2IRIM/Chat-Exporter-for-Chatgpt-Website)
（浮动按钮、部分导出、PDF 打印导出）。本项目的差异在于：
**多站点适配 + 通用启发式解析 + 页面结构自学习（手动校准）+ 完整测试与浏览器自检**。

## 功能特性

| 能力 | 说明 |
| --- | --- |
| 多站点 | ChatGPT（chatgpt.com / chat.openai.com）、DeepSeek（chat.deepseek.com）、豆包（doubao.com）；其它聊天页可用通用适配器 |
| 多格式 | Markdown（YAML front matter + 目录）、JSON、PDF（A4 打印文档）、HTML（自包含）、纯文本 |
| 部分导出 | 全量或指定消息区间（起止序号）；**序号旁实时标注该条消息的角色与开头文字**，导出后自动重新编号 |
| 富文本保真 | 代码块（带语言）、表格、行内/块级公式、列表、引用、链接、图片、`<details>` 折叠块 |
| 图片打包 | 勾选后把 Markdown 与图片一起打成 ZIP，文中图片链接自动改写为包内相对路径 |
| 思考过程 / 工具调用 / 引用 | 可选导出（ChatGPT 的 reasoning、DeepSeek / 豆包的思考块、网页引用） |
| 手动校准 | 站点改版识别不到时，点一条用户消息 + 一条助手消息，导出器学习页面结构并保存 |
| 结构诊断 | 面板内显示识别策略、候选行、角色置信度与告警，定位"为什么没导出到" |
| 多语言界面 | 简体中文 / English，按浏览器语言自动选择 |
| 纯本地 | 不发送任何数据到服务器；不申请 `<all_urls>`；仅在你点击时读取当前页面 |

## 快速开始

### 1. 安装（Chrome / Edge，约 1 分钟）

```bash
git clone https://github.com/xumou666/AI-Chat-Exporter-v0.1.0-ChatGPT-DeepSeek-doubao.git
# 也可以直接下载 ZIP 解压
```

1. 打开 `chrome://extensions`（Edge：`edge://extensions`）
2. 打开右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择仓库根目录（含 `manifest.json` 的那一层）
4. **刷新已经打开的对话页面**（内容脚本在页面加载时注入）

> 想先零风险试用？用浏览器直接打开 `demo/index.html`：内置一段模拟对话，不登录任何站点就能体验全部导出功能。

### 2. 第一次导出

1. 打开任一场对话页面 → 点右下角 **⇩ 导出当前对话**（或点浏览器工具栏的扩展图标）
2. 面板顶部会显示识别结果，例如"准备就绪 · 已识别 42 条消息（ChatGPT）"
3. 保持默认的 **Markdown**，点 **导出 Markdown** → 文件会下载到浏览器默认下载目录

完整的分步教程（含每种格式的取舍、图片打包、PDF、校准、FAQ）见 **[docs/使用教程.md](docs/使用教程.md)**。

## 使用教程

- 📘 **[完整使用教程](docs/使用教程.md)** — 从安装到进阶用法，含截图与排错
- 教程速览：

| 我想…… | 怎么做 |
| --- | --- |
| 导出整段对话为 Markdown | 打开面板 → 保持默认 → 点「导出 Markdown」 |
| 只导出其中几条 | 导出范围切到 `指定范围`，填起始 / 结束序号（序号下方会显示每条的开头文字） |
| 连图片一起带走 | 勾选「包含图片」→ 得到 ZIP（文档 + `images/`） |
| 生成 PDF | 格式选 `PDF` → 在打印窗口选择"另存为 PDF" |
| 保留模型的思考过程 | 勾选「包含思考过程」（Markdown 里会变成 `<details>` 折叠块） |
| 给文件起个好名字 | 修改「文件名模板」，支持 `{platform}` `{title}` `{date}` `{id}` `{model}` `{count}` |
| 网站改版后识别不到 | 点「手动校准」→ 先点一条用户消息，再点一条助手消息 |
| 看看到底识别到了什么 | 展开面板底部「结构诊断」 |

## 导出格式怎么选

| 格式 | 适合 | 会得到什么 |
| --- | --- | --- |
| **Markdown** | 归档、发博客、进笔记软件（Obsidian / Notion / Typora） | `*.md`，含 front matter + 目录 + 代码块语言标注 |
| **JSON** | 二次加工、喂给脚本或数据集 | `*.json`，schema 版本化（`ai-chat-exporter/conversation@1`） |
| **PDF** | 打印、发给别人、正式留档 | 浏览器"另存为 PDF"生成的 A4 文档 |
| **HTML** | 不想装 Markdown 阅读器、要直接分享 | 单个自包含 `*.html`（含内联样式） |
| **纯文本** | 贴进聊天窗口、做文本 diff | `*.txt`，只有角色与正文 |

<p align="center">
  <img src="docs/images/pdf-print.png" alt="PDF 导出用的 A4 打印页" width="620">
</p>

<p align="center"><sub>PDF 导出的排版：标题 / 元信息 / 目录 / 分角色小节，代码块与表格都会分页保护</sub></p>

## 导出样例

`examples/` 是 `npm run examples` 的真实产物（由 `tests/fixtures/` 的页面渲染而来），可以直接看输出长什么样：

| 文件 | 内容 |
| --- | --- |
| `chatgpt-sample.md` / `.json` / `.html` / `-print.html` | ChatGPT 会话（代码块、表格、公式、引用、思考过程） |
| `deepseek-sample.*` | DeepSeek 会话（哈希类名 DOM，走结构化识别） |
| `doubao-sample.*` | 豆包会话（`data-testid` 行） |
| `generic-sample.*` | 未知站点（通用启发式 + 交替角色推断） |
| `chatgpt-with-images.zip` | 文档 + `images/image-001-chart.png` 的图片资源包 |
| `chatgpt-partial-messages-3-4.md` / `.json` | **部分导出**：4 条消息只导出第 3–4 条，输出重新编号为 1、2 |

## 工作原理

```
页面 DOM
   │  ① 平台适配（src/platforms/*）
   ▼
候选消息行 ── ② 引擎（src/core/engine.js）
   │        · 命中平台选择器 → 直接用
   │        · 否则按"重复兄弟结构 / 交替结构"启发式发现消息列表
   │        · 角色判定：data-* 属性 → data-testid → class → 头像 alt → 文本对齐
   │        · 仍未知时按 用户/助手 交替推断（诊断里标注低置信度）
   ▼
HTML → Markdown（src/core/markdown.js，忽略按钮/头像等噪声）
   ▼
会话模型（src/core/schema.js）→ Markdown / JSON / HTML / 打印文档
   ▼
下载（MD/JSON/TXT/HTML/ZIP）或打印（PDF）；图片经 images.js 抓取后由 zip.js 打包
```

- **为什么能扛住改版**：平台适配器只提供"提示"（选择器、角色线索），行发现与角色推断都在通用引擎里；
  即使哈希类名全变（DeepSeek 常见），仍能靠结构识别。
- **完全改不动时**：手动校准会存下一组签名规则（按 host 存在 `chrome.storage.local`）。
- **零运行时依赖**：ZIP、Markdown 转换、打印文档全部自研，便于审计，也避免供应链风险。

## 常见问题

<details>
<summary><b>面板显示"未识别到消息"怎么办？</b></summary>

1. 确认页面已经加载完成（长对话先向上滚动，让历史消息渲染出来）；
2. 展开「结构诊断」看候选行数量：
   - 候选行为 0 → 多半是站点改版，用「手动校准」点两条消息即可恢复；
   - 候选行 > 0 但角色标成 low → 导出后检查一下角色是否错位，必要时校准。
3. 如果校准后仍然不对，欢迎带上面板里的诊断文本开 issue。
</details>

<details>
<summary><b>导出的图片是链接、但我想要图片文件？</b></summary>

勾选「包含图片」，导出会变成 ZIP：里面是文档 + `images/` 目录，文档中的图片链接已改写为 `images/xxx.png`。
图片下载失败会在面板里提示数量（部分站点的图片有防盗链或需要鉴权），文档本身仍会正常导出。
</details>

<details>
<summary><b>点 PDF 之后没有下载文件？</b></summary>

PDF 走浏览器打印对话框：会新开一个 A4 排版页面并自动唤起打印，在"目标打印机"里选 **另存为 PDF**，再点保存。
如果新窗口被拦截，请允许本站点的弹窗后重试。
</details>

<details>
<summary><b>公式变成 <code>$...$</code> 原文了？</b></summary>

Markdown/HTML 里保留 LaTeX 源码（GitHub、Obsidian、Typora 会渲染）；PDF 打印页会把 `$$…$$` 居中排版。
如果原页面把公式渲染成图片，就只能保留图片。
</details>

<details>
<summary><b>导出后发现用户/助手角色颠倒了怎么办？</b></summary>

从 0.1.2 起，判不准的角色会在面板里显式标出来：

1. **看标注**：范围预览里出现 `👤 用户（角色为推断）`，或状态栏出现 `⚠ 角色可能判断有误`，说明这条角色不是从页面直接读到的，而是推断出来的。
2. **看依据**：展开「结构诊断」，每行都带来源与置信度（`high` = 读到 `data-*` 属性 / testid；`medium` = 类名或 markdown 容器线索；`low` = 交替推断或修正过）。
3. **修正**：点「手动校准」，先点一条用户消息、再点一条助手消息；导出器会学习该页面的结构并在后续导出中优先使用。
4. 仍不对就带上面板里的诊断文本开 issue。

判定规则本身也做了加固：能匹配全部消息行的 testid 会被忽略（它命名的是"第几轮"，不是说话人）、被多行共享的外层容器不再当作角色依据、首条消息是助手时不再假设"第一条一定是用户"，并且全部被判成同一角色时会回退到「用户/助手」交替推断。
</details>

<details>
<summary><b>切换对话后，导出里混进了上一段对话或侧栏历史？</b></summary>

从 0.1.3 起解析器会先确定"当前这段对话"再取消息：

- **按消息层级取行**：不会再把"整个对话容器"当成一条消息（那样两段对话会变成两条）；
- **排除导航区**：`nav` / `aside` / 侧栏 / 历史列表里的内容不会当作消息；
- **排除隐藏内容**：`display:none`、`aria-hidden`、`hidden`、`visibility:hidden` 的整块（SPA 里被缓存的上一段对话）直接跳过；
- **多段对话只取一段**：若页面上同时存在多段对话，优先取屏幕上可见的那段，其次是消息更多的一段，并会在诊断里提示丢弃了多少条别的内容。

如果它仍然取错了段落，用「手动校准」点两条当前对话的消息即可；反馈问题时请把「结构诊断」里的 `strategy`、`clusters`、`dropped` 一并贴上。
</details>

<details>
<summary><b>长对话只导出后一半？</b></summary>

页面采用虚拟滚动，没渲染的消息不在 DOM 里。请先向上滚动把历史加载完（或分段导出后合并）。
</details>

<details>
<summary><b>怎么卸载 / 清除本地数据？</b></summary>

在 `chrome://extensions` 里移除扩展即可。扩展只在 `chrome.storage.local` 里保存面板设置与校准规则，卸载时随之删除。
</details>

## 已知限制

- **只导出已渲染的内容**：虚拟滚动未加载的历史消息不在 DOM 中。
- **站点改版**：选择器可能失效，此时用「手动校准」恢复（并欢迎反馈新的结构）。
- **PDF 需要一次人工点击**：浏览器不允许扩展静默生成 PDF。
- **图片抓取**：防盗链 / 鉴权失败的图片会被跳过（面板会提示数量）。
- **真实站点选择器未经登录环境验证**：仓库内的三站点夹具是按公开 DOM 结构编写的，首次在真实页面使用时建议看一下「结构诊断」。

## 开发与测试

```bash
npm install          # 只装测试用的 jsdom（扩展运行时不依赖任何包）
npm test             # 69 项测试：提取 / 序列化 / ZIP / 打印文档 / 校准 / 面板 / manifest 一致性
npm run examples     # 重新生成 examples/
npm run screenshots  # 用本机 Chrome/Edge 重新生成 docs/images/（可用 AICE_BROWSER 指定路径）
npm run icons        # 重新生成 assets/icon*.png
npm run package      # 打包成 dist/ai-chat-exporter-<version>.zip（可直接发 Release）
```

测试覆盖：

- **提取**：ChatGPT / DeepSeek / 豆包 / 通用四套夹具，断言消息数、角色序列、代码块、表格、公式、链接、图片、多行提示、输入框不被导出、图片不重复出现。
- **序列化**：YAML front matter、目录锚点、JSON 往返、文件名净化与模板、各格式 MIME。
- **ZIP**：CRC32 已知值、自身读回、UTF-8 文件名；另外用 Windows `Expand-Archive` 实际解压验证过互通性。
- **打印文档**：A4 `@page`、分页规则、代码 / 表格 / 图片、公式排版、脚本转义、弹窗拦截错误。
- **校准**：从两个样本推导签名、JSON 往返后仍可用、坏规则给出告警而不是静默导出。
- **面板与部分导出**：范围预览实时更新、越界标红并夹取、结束留空表示到最后一条、中英文标签、部分导出后序号不漂移、未识别到消息时的提示；并断言导出器不会把自身面板的文案当成对话内容。
- **打包一致性**：manifest 引用的文件都存在、脚本加载顺序满足依赖、Service Worker 注入清单与 manifest 一致、图标是合法 PNG、未申请 `<all_urls>`。
- **浏览器内自检**：`demo/selftest.html` 在真实 Chromium 中跑 10 项检查（含面板范围预览），页面标题会变成 `SELFTEST OK`。

```powershell
# 真实 Chromium（非 jsdom）自检
msedge --headless --disable-gpu --virtual-time-budget=8000 --dump-dom demo/selftest.html
```

## 目录结构

```
manifest.json               MV3 清单（权限、内容脚本顺序、图标）
src/core/dom.js             DOM 工具（可见性、文本、结构指纹、文档序）
src/core/markdown.js        HTML → Markdown 转换器
src/core/engine.js          通用提取引擎（行发现 / 角色判定 / 校准规则）
src/core/schema.js          会话数据模型与校验
src/core/serialize.js       Markdown / JSON / TXT / 文件名模板
src/core/html.js            Markdown → HTML、自包含 HTML / 打印文档
src/core/pdf.js             PDF 导出（打印文档 + 打印窗口）
src/core/range.js           部分导出范围解析与切片
src/core/zip.js             零依赖 ZIP 写入器（store + UTF-8 名 + CRC32）
src/core/images.js          图片抓取与打包
src/core/download.js        下载 / 复制到剪贴板
src/core/i18n.js            中英文文案
src/core/app.js             应用层：DOM → 会话 → 导出载荷
src/platforms/*.js          ChatGPT / DeepSeek / 豆包 / 通用适配器 + 注册表
src/ui/panel.js, panel.css  页面内浮动面板
src/content.js              内容脚本入口（装配 + 下载 + 校准 + 消息接口）
src/background.js           Service Worker（工具栏点击 / 按需注入）
tests/                      jsdom 测试（69 项）与 HTML 夹具
tools/                      图标、样例、截图、打包脚本
examples/                   真实导出样例
docs/                       使用教程与截图
demo/                       离线演示页、同步 UI 预览页、浏览器自检页
```

## 更新日志

版本历史见 **[CHANGELOG.md](CHANGELOG.md)**；当前版本 **0.1.3**（2026-09-14）。

发版时版本号出现在三处，`tests/manifest.test.js` 会校验它们一致，避免"扩展显示一个版本、导出文件里写着另一个"：

| 位置 | 作用 |
| --- | --- |
| `manifest.json` 的 `version` | `chrome://extensions` 卡片与扩展详情页显示的版本 |
| `package.json` 的 `version` | `npm run package` 产出的 `dist/ai-chat-exporter-<version>.zip`，也是 CHANGELOG 的标题版本 |
| `src/core/schema.js` 的 `EXPORTER_VERSION` | 导出文件里的 `exporter:`（Markdown front matter）与 `meta.exporter.version`（JSON） |

发新版本的最小流程：改这三处 → 在 `CHANGELOG.md` 顶部加一节 → `npm test` → 提交推送 → 打 tag 并推送：

```bash
npm test
git commit -am "chore(release): v0.1.4"
git push
git tag v0.1.4 && git push origin v0.1.4
```

推送 tag 后 [`release.yml`](.github/workflows/release.yml) 会自动跑测试、用 `npm run package` 打包扩展，
并创建带 ZIP 附件的 GitHub Release；若 tag 与 `package.json` 的版本不一致会直接失败，避免发错版本。
Release 列表：<https://github.com/xumou666/AI-Chat-Exporter-v0.1.0-ChatGPT-DeepSeek-doubao/releases>。

## 隐私

全部处理都在你的浏览器内完成，不请求任何自建服务器，详见 [PRIVACY.md](PRIVACY.md)。

## 许可与致谢

MIT，见 [LICENSE](LICENSE)。

内容方案参考 [Z2IRIM/Chat-Exporter-for-Chatgpt-Website](https://github.com/Z2IRIM/Chat-Exporter-for-Chatgpt-Website)（MIT），
本项目代码为独立实现；`jsdom` 仅用于测试。
