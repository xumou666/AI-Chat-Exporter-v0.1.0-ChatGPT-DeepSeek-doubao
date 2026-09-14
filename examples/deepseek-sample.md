---
title: "如何优化慢 SQL"
platform: DeepSeek
platform_id: deepseek
url: "https://chat.deepseek.com/a/chat/s/9f8e7d6c"
conversation_id: 9f8e7d6c
exported_at: "2026-09-14T09:29:12.781Z"
message_count: 4
exporter: AI Chat Exporter 0.1.3
schema: "ai-chat-exporter/conversation@1"
---

# 如何优化慢 SQL

> **平台**: DeepSeek ｜ **消息数**: 4 ｜ **导出时间**: 2026-09-14 17:29
>
> 来源: <https://chat.deepseek.com/a/chat/s/9f8e7d6c>

## 目录

- [1. 👤 用户](#1--用户)
- [2. 🤖 助手](#2--助手)
- [3. 👤 用户](#3--用户)
- [4. 🤖 助手](#4--助手)

---

## 1. 👤 用户

线上有一条 SQL 很慢，怎么排查和优化？

---

## 2. 🤖 助手

排查慢 SQL 一般分三步：

1. 用 `EXPLAIN` 看执行计划
2. 确认索引是否命中
3. 检查回表与排序

```sql
EXPLAIN ANALYZE
SELECT id, name FROM users WHERE email = 'a@b.com';
```

---

## 3. 👤 用户

email 上没有索引，加索引会更快吗？

---

## 4. 🤖 助手

会。等值查询加普通二级索引即可把全表扫描变成索引查找：

```sql
CREATE INDEX idx_users_email ON users (email);
```

注意写入放大与基数问题，低基数列（如性别）通常不值得建索引。
