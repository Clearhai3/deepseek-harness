/** Creating the minimal archive skeleton in an empty archive root. */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { INDEX_FILENAME, dailyEntryPath } from './archive-index.ts'
import { readClock } from './archive-clock.ts'
import { daySeed } from './archive-day.ts'

/** Section path the skeleton declares for notes; the map and the note must agree. */
const NOTES_PATH = 'notes/'

/** Map written into a fresh archive. */
const SKELETON_MAP = `# 这是你的档案地图，插件照着它找到你的东西。
# level -> AI 能做什么: gated 需授权 / soft 可自改但留痕 / free 随便写
# warning -> 人改之前的提醒: strong 强警告 / light 轻提醒 / none 不提醒
version: 2
sections:
  - name: about
    path: about.md
    kind: reference
    level: soft
    warning: strong
    description: 关于我 —— 我是谁、我在做什么、希望 AI 怎么配合我
  - name: notes
    path: ${NOTES_PATH}
    kind: append
    level: free
    warning: none
    layout: daily
    description: 我的笔记 —— 随手记，一天一页
`

/** `about.md` a fresh archive starts with. */
const SKELETON_ABOUT = `# 关于我

## 我是谁
<!-- 一两句就够，比如: 我在厦门读大学，专业是大数据 -->

## 我在做什么
<!-- 手上的项目、目标、进行到哪了 -->

## 我希望 AI 怎么配合我
<!-- 比如: 先讲原理再给代码 / 别替我改文件 / 说话直接点 -->
`

/** What one `archive_init` call produced. */
export interface ArchiveInitResult {
  /** Absolute archive root that received the skeleton. */
  readonly root: string
  /** Archive-relative paths this call created. */
  readonly created: readonly string[]
  /** Archive-relative paths that already existed and were left untouched. */
  readonly kept: readonly string[]
}

/**
 * Create the minimal archive skeleton.
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @param now - local clock reading; injected so tests can pin the date.
 * @returns  which files were created and which were already there.
 * @throws when the archive already has a map.
 */
export async function initArchive(ctx: Context, root: string, now: Date): Promise<ArchiveInitResult> {
  const map = await ctx.fs.resolve(join(root, INDEX_FILENAME))
  if (await ctx.fs.stat(map) !== undefined) {
    throw new Error(`memory archive: ${INDEX_FILENAME} already exists under ${root}; refusing to overwrite an archive`)
  }
  const clock = readClock(now)
  const created: string[] = []
  const kept: string[] = []
  const fillers = [
    { path: 'about.md', text: SKELETON_ABOUT },
    { path: dailyEntryPath(NOTES_PATH,clock. date), text: daySeed(clock) },
  ]
  for (const filler of fillers) {
    const target = await ctx.fs.resolve(join(root, filler.path))
    if (await ctx.fs.stat(target) !== undefined) {
      kept.push(filler.path)
      continue
    }
    await ctx.fs.writeText(target, filler.text, { kind: 'createIfAbsent' })
    created.push(filler.path)
  }
  // The map lands last: it is the proof an archive exists, so a half-done run must not leave one behind.
  await ctx.fs.writeText(map, SKELETON_MAP, { kind: 'createIfAbsent' })
  created.push(INDEX_FILENAME)
  return { root, created, kept }
}
