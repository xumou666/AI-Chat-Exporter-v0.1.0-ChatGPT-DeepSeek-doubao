---
title: "Python 列表去重"
platform: ChatGPT
platform_id: chatgpt
url: "https://chatgpt.com/c/abc123"
conversation_id: abc123
exported_at: "2026-09-13T11:42:24.770Z"
message_count: 4
exporter: AI Chat Exporter 0.1.0
schema: "ai-chat-exporter/conversation@1"
---

# Python 列表去重

> **平台**: ChatGPT ｜ **消息数**: 4 ｜ **导出时间**: 2026-09-13 19:42
>
> 来源: <https://chatgpt.com/c/abc123>

## 目录

- [1. 👤 用户](#1--用户)
- [2. 🤖 助手](#2--助手)
- [3. 👤 用户](#3--用户)
- [4. 🤖 助手](#4--助手)

---

## 1. 👤 用户

如何用 Python 给列表去重？  
要求：  
1. 保持原有顺序  
2. 给出时间复杂度

---

## 2. 🤖 助手

可以用 `dict.fromkeys` 保持顺序去重：

```python
items = [1, 2, 2, 3, 1]
unique = list(dict.fromkeys(items))
print(unique)  # [1, 2, 3]
```

几种方案的对比：

| 方案 | 时间复杂度 | 是否保序 |
| --- | --- | --- |
| dict.fromkeys | O(n) | 是 |
| set | O(n) | 否 |

- 需要保序：**dict.fromkeys**
- 不关心顺序：`list(set(items))`

$$
T(n) = O(n)
$$

参考 [Python 官方文档](https://docs.python.org/3/library/stdtypes.html#dict.fromkeys)。

![性能对比图](https://cdn.example.com/chart.png)

**参考链接**

1. [Python 官方文档](https://docs.python.org/3/library/stdtypes.html#dict.fromkeys)

---

## 3. 👤 用户

如果元素是字典呢？

---

## 4. 🤖 助手

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
