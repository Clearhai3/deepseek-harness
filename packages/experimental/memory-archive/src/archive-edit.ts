/** Editing text that is already on disk, under the same permission matrix as append. */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ArchiveIndex, ArchiveSection } from './archive-index.ts'
import { appendToArchive } from './archive-append.ts'
import { commitText } from './archive-commit.ts'
import { decideWrite } from './archive-policy.ts'
import { resolveSection, sectionPath } from './archive-source.ts'

export interface EditRequest {
  readonly section: string
  readonly file?: string      // 目录型区块必填 (同 archive_read)
  readonly old: string        // 必须原样存在，且只出现一次
  readonly new: string        // 替换成什么；'' = 删掉这一段
}

export interface EditResult {
  readonly section: string
  readonly path: string
  readonly line: number       // old 起始行号 (1 起)
  readonly before: string
  readonly after: string
  readonly changed: boolean   // old === new 时为 false
  readonly trail?: { path: string }     // soft 区自动留痕写到哪
}

/** @returns needle 在 haystack 里出现的次数。 */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

/** @returns offset 所在的行号 (1起) 。 */
export function lineOf(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length
}

/** @returns 第一行的前 80 个字符，用于留痕摘要。 */
export function firstLine(text: string): string {
  const end = text.indexOf('\n')
  return (end === -1 ? text : text.slice(0, end)).slice(0, 80)
}

/**
 * @param text - 当前文件内容。
 * @param old - 要被替换的原文。
 * @param new - 替换后的文本；空串表示删除。
 * @returns 替换后的全文。
 * @throws old 为空、找不到、或出现多次时。
 */
export function applyEdit(text: string, search: string, replace: string): string {
  if (search.length === 0) throw new Error('memory archive: `old` must not be empty')
  const count = countOccurrences(text, search)
  if (count === 0) throw new Error('memory archive: `old` was not found; read the section and copy it verbatim')
  if (count > 1) throw new Error(`memory archive: \`old\` appears ${count} times; give more surrounding context so it is unique`)
  return text.replace(search, replace)   // 唯一，替换第一个就是替换全部
}

/**
 * @returns the only daily log section, or undefined when there is none or more than one.
 */
function singleDailySection(index: ArchiveIndex): ArchiveSection | undefined {
  const daily = index.sections.filter(entry => entry.kind === 'append' && entry.layout === 'daily')
  return daily.length === 1 ? daily[0] : undefined
}

/**
 * @param index - the validated map.
 * @param section - name of the soft section about to be edited, used in the failure message.
 * @returns the section the trail entry goes into.
 * @throws when no trail target can be determined without guessing.
 */
function resolveTrailTarget(index: ArchiveIndex, section: string): ArchiveSection {
  const target = index.trail !== undefined ? resolveSection(index, index.trail) : singleDailySection(index)
  if (target === undefined) {
    throw new Error(
      `memory archive: section ${JSON.stringify(section)} is soft and must leave a trail, but no single daily log `
        + 'section was found. Declare one (`kind: append`, `layout: daily`) or point at it with a top-level '
        + '`trail: <section>` in archive.yaml.',
    )
  }
  // 留痕本身写不进去时，这次编辑必须整笔取消：soft 要的正是"你一定知道"。
  const decision = decideWrite(target)
  if (!decision.allowed) {
    throw new Error(
      `memory archive: section ${JSON.stringify(section)} is soft and must leave a trail, but its trail target `
         + `${JSON.stringify(target.name)} cannot be written: ${decision.reason}`,
    )
  }
  return target
}

export async function editArchive(
  ctx: Context, root: string, index: ArchiveIndex, request: EditRequest,
  now: Date, host: string, exec?: ToolRunContext,
): Promise<EditResult> {
  const section = resolveSection(index, request.section)
  const descision = decideWrite(section)
  if (!descision.allowed) throw new Error(descision.reason)

  const trail = descision.needsTrail ? resolveTrailTarget(index, section.name) : undefined

  const relative = sectionPath(section.path, request.file)  // <- 目录型区块必须给 file
  const target = await ctx.fs.resolve(join(root, relative))
  const info = await ctx.fs.stat(target)
  if (info === undefined) throw new Error(`memory archive: ${relative} does not exist`)
  if (info.type === 'directory') {
    throw new Error(`memory archive: ${relative} is a directory; pass \`file\` to edit one page inside it`)
  }

  const before = await ctx.fs.readText(target)
  const after = applyEdit(before, request.old, request.new)
  const line = lineOf(before, before.indexOf(request.old))

  if (after === before) {
    return { section: section.name, path: relative, line, before: request.old, after: request.new, changed: false }
  }

  await commitText(ctx, root, relative, current => applyEdit(current, request.old, request.new), exec)

  const result = { section: section.name, path: relative, line, before: request.old, after: request.new, changed: true }
  if (trail === undefined) return result

  const appended = await appendToArchive(ctx, root, index, {
    section: trail.name,
    text: `改了 ${section.name} (${relative}:${line}): ${firstLine(request.old)} -> ${firstLine(request.new)}`,
    tags: ['⭐', '档案', 'edit'],
  }, now, host, exec)
  return { ...result, trail: { path: appended.path } }
}
