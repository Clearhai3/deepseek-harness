/** Renders `archive_check` hits for the model. */

import type { CheckResult } from './archive-check.ts'
import { renderMeta } from './archive-entry.ts'
import { MAX_READ_BYTES } from './archive-source.ts'
import { format } from './archive-time.ts'

/** 正文摘要要在呈现里最多留几个字符。 */
export const SUMMARY_CHARS = 30
/** 一行里各列之间的分隔。双空格只写这一次。 */
const COLUMN_GAP = '  '

/**
 * @param text - 正文。
 * @returns 首行；超过 SUMMARY_CHARS 个字符就截断加省略号。按码点计数，不会切坏表情。
 */
export function summarize(text: string): string {
  const chars = [...(text.split('\n')[0] as string)]
  return chars.length <= SUMMARY_CHARS ? chars.join('') : `${chars.slice(0, SUMMARY_CHARS).join('')}…`
}

/**
 * @param skipped - 因为太大而没被读的文件。
 * @returns 一句提醒；没有跳过时是 undefined。
 */
function skipNote(skipped: readonly string[]): string | undefined {
  if (skipped.length === 0) return undefined
  const limit = `${Math.round(MAX_READ_BYTES / (1024 * 1024))} MB`
  return `Skipped ${skipped.length} file(s) above the ${limit} limit: ${skipped.join(', ')}`
}

/**
 * @param result - 命中，以及被跳过的文件。
 * @returns 一行一条；有文件被跳过时，末尾必须说清，绝不静默。
 */
export function renderCheck(result: CheckResult): string {
  const lines = result.hits.map(hit => [
    `${hit.path}:${hit.line}`,
    format(hit.entry.at),
    renderMeta(hit.entry.tags, hit.entry.fields),
    summarize(hit.entry.text),
  ].join(COLUMN_GAP))
  const note = skipNote(result.skipped)
  if (lines.length === 0) {
    return note === undefined ? 'No entries matched.' : `No entries matched the filter. ${note}`
  }
  return note === undefined ? lines.join('\n') : `${lines.join('\n')}\n\n${note}`
}
