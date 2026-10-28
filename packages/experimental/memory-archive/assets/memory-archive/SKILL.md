---
name: memory-archive
description: The user's memory of past sessions. Load when a session starts or ends, when something worth keeping happens, or when the user refers to something from before.
---

# Memory archive

The user's own files. `archive.yaml` declares the sections; list before writing, never guess a section name. Time and `主机` are stamped by the tool — never pass them.

## Tools
- `archive_list` — the sections declared by the map
- `archive_check` — find entries by time range and tags (never body text)
- `archive_read` — open one section, or one file inside a directory section
- `archive_append` — append one entry to a log section
- `archive_init` — create a minimal skeleton in an empty archive root