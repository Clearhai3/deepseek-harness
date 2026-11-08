---
name: memory-archive
description: The user's memory of past sessions. Load when a session starts or ends, when something worth keeping happens, or when the user refers to something from before.
---

# Memory archive

The user's own files. `archive.yaml` declares the sections; list before writing, never guess a section name. Time and `主机` are stamped by the tool — never pass them.

Tags: `⭐` first when the entry matters, then exactly one category — `打卡` / `落地` / `踩坑` / `决策` / `对话` — then a domain word reused from the archive, then 0–2 free topic words.

## Every session

If the archive declares `temp` and `todo`, read them first. `temp` is both "what must be loaded every time" and the 3-day tidying reminder (`上次整理`); its entries age 3 / 9 / 15 / 30 days — the older one is, the firmer the decision must be. At 30 days it moves to `longterm`, which is kept, never deleted.

## After `archive_init`

A fresh archive is a skeleton, not a usable memory. Before anything else:

1. Ask **one** question, then wait. Start with how to address the user — you cannot greet someone you cannot name.
2. Then ask what they are working on, and how they want you to work with them (principle first? no editing their code? shorter answers?). Both may be skipped, but ask them.
3. Write the answers into `about.md` with `archive_edit`, one exact replacement per slot. Never invent detail; when they decline, leave the slot empty and say it is empty.
4. Copy a short version into the handbook's section 关于用户 (`AGENTS.md`): 4-6 lines — 称呼 / 在做什么 / 交流习惯 / 禁忌 / the pointer 全文在 `about.md`. Short by design: the handbook is injected every turn.
5. Leave 当前状态 and 我犯过的错 empty. They grow from real work, not from questions.

## Tools
- `archive_list` — the sections declared by the map
- `archive_check` — find entries by time range and tags (never body text)
- `archive_read` — open one section, or one file inside a directory section
- `archive_append` — append one entry to a log section
- `archive_init` — create the minimal skeleton in an empty archive root: the map, `AGENTS.md` (handbook skeleton with empty instance slots), `README.md`, `about.md`, and the first daily page
- `archive_edit` — replace one exact piece of text; `old` must appear exactly once, soft sections leave a ⭐ trail
- `archive_create` — create a page the map declares but disk lacks; logs go through append, existing pages through edit
- `archive_time` — the archive clock; also the gap from a past moment to now
- `archive_due` — which `temp` entries reached 3 / 9 / 15 / 30 days, plus the broken ones
- `archive_promote` — move 30-day-old `temp` entries into `longterm`; writes before it deletes
- `archive_map_write` — replace the whole map document; every change is shown to the user for approval before it is written
\ No newline at end of file