/** 把活满 30 天的限时记忆从 temp 搬进 longterm：先写新家，再拆旧家。 */

import { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { ArchiveIndex } from './archive-index.ts'
import { Context } from '@deepseek-ai/cordis'
import { splitEntriesWithLines } from './archive-entry.ts'
import { readArchiveTarget } from './archive-source.ts'
import { readClock } from './archive-clock.ts'
import { dueEntries } from './archive-due.ts'
import { appendToArchive } from './archive-append.ts'
import { editArchive } from './archive-edit'

const TEMP_SECTION = 'temp'
const LONGTERM_SECTION = 'longterm'

export interface PromoteResult {
  readonly promoted: readonly { readonly line: number; readonly start: string; readonly age: number; readonly text: string }[]
  readonly skipped: number    // 还不到 30 天的（只报数）
  readonly malformed: number  // 写坏的：不搬，也不删
}

export async function promoteExpired(
  ctx: Context, root: string, index: ArchiveIndex, now: Date, host: string, exec?: ToolRunContext,
): Promise<PromoteResult> {
  const page = await readArchiveTarget(ctx, root, index, TEMP_SECTION)
  if (page.kind !== 'file') {
    throw new Error(`memory archive: ${page.path} is a directory, but \`temp\` must be a single file`)
  }

  const today = readClock(now).date
  const report = dueEntries(page.text, today)

  const promoted: { line: number; start: string; age: number; text: string }[] = []
  let skipped = report.quiet

  for (const entry of report.entries) {
    if (entry.level !== 'expire') {
      skipped += 1
      continue
    }
    const block = blockAt(page.text, entry.line)

    // 先写新家
    await appendToArchive(ctx, root, index, {
      section: LONGTERM_SECTION,
      text: entry.text,
      tags: ['长期', '迁入'],
      fields: { 起始: entry.start, 迁于: today },
    }, now, host, exec)

    // 再拆旧家
    await editArchive(ctx, root, index, { section: TEMP_SECTION, old: block, new: '' }, now, host, exec)

    promoted.push({ line: entry.line, start: entry.start, age: entry.age, text: entry.text })
  }

  return { promoted, skipped, malformed: report.malformed.length }
}

function blockAt(text: string, line: number): string {
  const lines = text.split('\n')
  const hits = splitEntriesWithLines(text)
  const at = hits.findIndex(hit => hit.line === line)
  const next = hits[at + 1]
  const start = line - 1
  // 连前面那个空行一起删，不然每迁一条就多一个空行，日积月累
  const begin = start > 0 && lines[start - 1] === '' ? start - 1 : start
  const end = next === undefined ? lines.length : next.line - 1
  return lines.slice(begin, end).join('\n').trimEnd()
}
