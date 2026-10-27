/** Renders `archive_check` hits for the model. */

import { renderMeta, type Entry } from './archive-entry.ts'
import { format } from './archive-time.ts'

/** 正文摘要要在呈现里最多留几个字符。 */
export const SUMMARY_CHARS = 30
/** 一行里各列之间的分隔。双空格只写这一次。 */
const COLUMN_GAP = '  '

/** 一条命中: 它在档案里的位置，以及那条记录。 */
export interface CheckHit {
  /** 档案相对路径。 */
  readonly path: string
  /** 记录首行行号，从 1 开始。 */
  readonly line: number
  readonly entry: Entry
}

/**
 * @param text - 正文。
 * @returns 首行；超过 SUMMARY_CHARS 个字符就截断加省略号。按码点计数，不会切坏表情。
 */
export function summarize(text: string): string {
  const chars = [...(text.split('\n')[0] as string)]
  return chars.length <= SUMMARY_CHARS ? chars.join('') : `${chars.slice(0, SUMMARY_CHARS).join('')}…`
}

/**
 * @param hits - 命中，顺序由调用方决定。
 * @returns 一行一条: `相对路径:行号  时间戳  [元数据]  摘要`；没有命中时说明一句。
 */
export function renderCheck(hits: readonly CheckHit[]): string {
  if (hits.length === 0) return 'No entries matched.'
  return hits
    .map(hit => [
      `${hit.path}:${hit.line}`,
      format(hit.entry.at),
      renderMeta(hit.entry.tags, hit.entry.fields),
      summarize(hit.entry.text),
    ].join(COLUMN_GAP))
    .join('\n')
}
