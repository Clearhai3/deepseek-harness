/** Searching the archive's log sections for entries by time and metadata. */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { type Entry, findEntries, type EntryFilter } from './archive-entry.ts'
import type { ArchiveIndex, ArchiveSection } from './archive-index.ts'
import { MAX_READ_BYTES, resolveSection } from './archive-source.ts'

/** 目录最多往下走几层。`YYYY-MM` 一层就够；真档案平铺是零层。 */
const MAX_DEPTH = 2

/** 一条命中: 它在档案里的位置，以及那条记录。 */
export interface CheckHit {
  /** 档案相对路径。 */
  readonly path: string
  /** 记录首行行号，从 1 开始。 */
  readonly line: number
  readonly entry: Entry
}

/**一次搜索的结果。 */
export interface CheckResult {
  /** 命中，按时间升序。 */
  readonly hits: readonly CheckHit[]
  /** 因为太大而跳过的档案相对路径。 */
  readonly skipped: readonly string[]
}

/**
 * @param index - validated map.
 * @param name - section the caller named.
 * @returns the section, when it is a log.
 * @throws when it is unknown or not `kind: append`.
 */
function requireLog(index: ArchiveIndex, name: string): ArchiveSection {
  const section = resolveSection(index, name)
  if (section.kind !== 'append') {
    throw new Error(
      `memory archive: section ${JSON.stringify(name)} is ${section.kind}, not a log; `
                + 'check reads `kind: append` sections',
    )
  }
  return section
}

/**
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @param relative - section path; a file returns itself, a directory is walked.
 * @returns archive-relative `.md` files, at most MAX_DEPTH levels down.
 */
async function filesUnder(ctx: Context, root: string, relative: string): Promise<string[]> {
  const base = relative.replace(/\/+$/u, '')
  const info = await ctx.fs.stat(await ctx.fs.resolve(join(root, base)))
  if (info === undefined) return []
  if (info.type === 'file') return base.endsWith('.md') ? [base] : []
  if (info.type !== 'directory') return []

  const found: string[] = []
  const walk = async (absolute: string, at: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) return
    for (const entry of await ctx.fs.listDir(await ctx.fs.resolve(absolute))) {
      const childAbsolute = join(absolute, entry.name)
      const child = `${at}/${entry.name}`
      if (entry.type === 'directory') await walk(childAbsolute, child, depth + 1)
      else if (entry.type === 'file' && entry.name.endsWith('.md')) found.push(child)
    }
  }
  await walk(join(root, base), base, 0)
  return found
}

/**
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @param index - validated map.
 * @param filter - time range and tags; at least one axis is required.
 * @param name - restrict the search to one log section; omit to search every `kind: append`.
 * @returns hits in time order, plus the files that were skipped.
 * @throws when the filter is empty on every axis, or `name` is not a log section.
 */
export async function checkArchive(
  ctx: Context, root: string, index: ArchiveIndex, filter: EntryFilter, name?: string,
): Promise<CheckResult> {
  const hasTags = filter.tags !== undefined && filter.tags.length > 0
  if (filter.from === undefined && filter.to === undefined && !hasTags) {
    throw new Error('memory archive: check needs a time range or at least one tag; there is no default window')
  }
  const sections = name === undefined
    ? index.sections.filter(section => section.kind === 'append')
    : [requireLog(index, name)]

  const hits: CheckHit[] = []
  const skipped: string[] = []
  for (const section of sections) {
    for (const path of await filesUnder(ctx, root, section.path)) {
      const target = await ctx.fs.resolve(join(root, path))
      const info = await ctx.fs.stat(target)
      if (info === undefined || info.type !== 'file') continue
      if (info.size !== undefined && info.size > MAX_READ_BYTES) {
        skipped.push(path)
        continue
      }
      for (const hit of findEntries(await ctx.fs.readText(target), filter)) {
        hits.push({ path, line: hit.line, entry: hit.entry })
      }
    }
  }
  hits.sort((left, right) => left.entry.at.getTime() - right.entry.at.getTime())
  return { hits, skipped }
}
