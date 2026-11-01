/** 把迁移结果排成人话。 */

import type { PromoteResult } from './archive-promote.ts'

/**
 * @param result - 一次迁移的结果。
 * @returns 多行文本，一行一件事情。
 */
export function renderPromote(result: PromoteResult): string {
  const lines = result.promoted.length === 0
    ? ['没有活满 30 天的限时记忆，什么都没动']
    : [`迁走 ${result.promoted.length} 条到 longterm：`]
  for (const entry of result.promoted) {
    lines.push(`- ${entry.text}（起始 ${entry.start}，${entry.age} 天）`)
  }
  if (result.skipped > 0) lines.push(`留在 temp 的：${result.skipped} 条`)
  if (result.malformed > 0) lines.push(`写坏的：${result.malformed} 条（一条没动）`)
  return lines.join('\n')
}
