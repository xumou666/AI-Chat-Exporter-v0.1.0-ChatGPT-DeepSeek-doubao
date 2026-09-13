---
title: "Python 列表去重"
platform: ChatGPT
platform_id: chatgpt
url: "https://chatgpt.com/c/abc123"
conversation_id: abc123
exported_at: "2026-09-13T11:42:24.918Z"
message_count: 2
exporter: AI Chat Exporter 0.1.0
schema: "ai-chat-exporter/conversation@1"
---

# Python 列表去重

> **平台**: ChatGPT ｜ **消息数**: 2 ｜ **导出时间**: 2026-09-13 19:42
>
> 来源: <https://chatgpt.com/c/abc123>

## 目录

- [1. 👤 用户](#1--用户)
- [2. 🤖 助手](#2--助手)

---

## 1. 👤 用户

如果元素是字典呢？

---

## 2. 🤖 助手

<details>
<summary>思考过程</summary>

用户问的是不可哈希元素，需要用 key 函数。

</details>

字典不可哈希，可以用 `json.dumps` 或元组做 key：

```python
seen = set()
unique = []
for d in rows:
    key = tuple(sorted(d.items()))
    if key not in seen:
        seen.add(key)
        unique.append(d)
```

> 字典本身没有顺序，保序只对列表有意义。
