/** 把到期清单排成人话。 */

import type { DueLevel, DueReport } from './archive-due.ts'

const LEVEL_NAMES: Record<DueLevel, string> = {
  quiet: '还不到 3 天',
  small: '小提醒',
  big: '大提醒',
  urgent: '必须决策',
  expire: '迁 longterm',
}

/**
 * @param report - 限时记忆的分档结果。
 * @returns 多行文本，一行一条；坏条目用 `!` 开头。
 */
export function renderDue(report: DueReport): string {
  const lines = report.entries.length === 0
    ? [`今天 ${report.today} · 没有到期的限时记忆（还不到 3 天的 ${report.quiet} 条）`]
    : [`今天 ${report.today} · ${report.entries.length} 条到期（还不到 3 天的 ${report.quiet} 条）`]
  for (const entry of report.entries) {
    lines.push(`- L${entry.line} · ${entry.age} 天 · ${LEVEL_NAMES[entry.level]} · ${entry.start} · ${entry.text}`)
  }
  for (const bad of report.malformed) {
    lines.push(`! L${bad.line} · ${bad.reason} · 原文: ${bad.raw}`)
  }
  return lines.join('\n')
}
