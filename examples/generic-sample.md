---
title: Renamed widget
platform: "网页对话"
platform_id: generic
url: "https://somechat.example.com/t/42"
exported_at: "2026-09-14T09:13:36.246Z"
message_count: 4
exporter: AI Chat Exporter 0.1.2
schema: "ai-chat-exporter/conversation@1"
---

# Renamed widget

> **平台**: 网页对话 ｜ **消息数**: 4 ｜ **导出时间**: 2026-09-14 17:13
>
> 来源: <https://somechat.example.com/t/42>

## 目录

- [1. 👤 用户](#1--用户)
- [2. 🤖 助手](#2--助手)
- [3. 👤 用户](#3--用户)
- [4. 🤖 助手](#4--助手)

---

## 1. 👤 用户

Why is my widget re-rendering twice?

---

## 2. 🤖 助手

Because the effect depends on an object literal that is re-created every render.

```jsx
useEffect(() => {
  load(options);
}, [options]);
```

---

## 3. 👤 用户

How do I fix it?

---

## 4. 🤖 助手

Memoise the object or depend on its primitive fields:

```jsx
const stable = useMemo(() => ({ id }), [id]);
useEffect(() => { load(stable); }, [stable]);
```
