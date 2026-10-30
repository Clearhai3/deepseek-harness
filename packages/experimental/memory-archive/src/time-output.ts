/** 把时间回答排成人话。 */

import type { TimeAnswer } from './archive-time-query.ts'

/**
 * @param answer - 时间工具的回答。
 * @returns 多行文本，一行一件事。
 */
export function renderTime(answer: TimeAnswer): string {
  const lines = [`现在: ${answer.date} ${answer.time} (${answer.weekday})`]
  if (answer.machineReading !== undefined) {
    lines.push(`本机时钟与档案时区不一致：${answer.machineReading}`)
  }
  if (answer.since !== undefined && answer.elapsed !== undefined) {
    lines.push(`从 ${answer.since} 到现在：已过 ${answer.elapsed}`)
  }
  if (answer.span !== undefined) lines.push(`两时刻相隔：${answer.span}`)
  return lines.join('\n')
}
