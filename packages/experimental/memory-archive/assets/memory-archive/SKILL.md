---
name: memory-archive
description: The user's memory of past sessions. Load when a session starts or ends, when something worth keeping happens, or when the user refers to something from before.
---

# Memory archive

The user's own files. `archive.yaml` declares the sections; list before writing, never guess a section name. Time and `主机` are stamped by the tool — never pass them.

Tags: `⭐` first when the entry matters, then exactly one category — `打卡` / `落地` / `踩坑` / `决策` / `对话` — then a domain word reused from the archive, then 0–2 free topic words.

## Every session

If the archive declares `temp` and `todo`, read them first. `temp` is both "what must be loaded every time" and the 3-day tidying reminder (`上次整理`); its entries age 3 / 9 / 15 / 30 days — the older one is, the firmer the decision must be. At 30 days it moves to `longterm`, which is kept, never deleted.

## Tools
- `archive_list` — the sections declared by the map
- `archive_check` — find entries by time range and tags (never body text)
- `archive_read` — open one section, or one file inside a directory section
- `archive_append` — append one entry to a log section
- `archive_init` — create a minimal skeleton in an empty archive root
- `archive_edit` — replace one exact piece of text; `old` must appear exactly once, soft sections leave a ⭐ trail
- `archive_time` — the archive clock; also the gap from a past moment to now
- `archive_due` — which `temp` entries reached 3 / 9 / 15 / 30 days, plus the broken ones
- `archive_promote` — move 30-day-old `temp` entries into `longterm`; writes before it deletes
- `archive_map_write` — replace the whole map document; every change is shown to the user for approval before it is written
\ No newline at end of file