/** 限时记忆的年龄分档：数日子，不读时钟、不碰文件。 */

import { ARCHIVE_OFFSET_MINUTES } from './archive-clock.ts'
import { splitEntriesWithLines } from './archive-entry.ts'
import { parseBoundary } from './archive-time.ts'

/** 一档的判据：满这么多天就算这一档。 */
export const DUE_LEVELS = [
  { level: 'small', at: 3 },
  { level: 'big', at: 9 },
  { level: 'urgent', at: 15 },
  { level: 'expire', at: 30 },
] as const

export type DueLevel = 'quiet' | typeof DUE_LEVELS[number]['level']

/** 一条到期的限时记忆。 */
export interface DueEntry {
  readonly line: number           // 在 temp 文件里的行号，方便我直接 archive_read 去看
  readonly start: string          // 起始，原文照抄 'YYYY-MM-DD'
  readonly age: number            // 日历天数 (不是毫秒！)
  readonly level: DueLevel
  readonly tags: readonly string[]
  readonly text: string           // 正文第一行，用来让我我认出是哪条
}

/** 长得不像限时记忆、或者日子不合理的条目。**不许静默丢掉**。 */
export interface DueMalformed {
  readonly line: number
  readonly raw: string
  readonly reason: string
}

export interface DueReport {
  readonly today: string                  // 'YYYY-MM-DD'，档案时区
  readonly entries: readonly DueEntry[]   // 只含 level !== 'quiet'
  readonly quiet: number                  // 达不到 3 天的条数 (只报个数字)
  readonly malformed: readonly DueMalformed[]
}

/**
 * @param text - temp 整篇正文。
 * @param today - 档案时区的今天，'YYYY-MM-DD'。
 */
export function dueEntries(text: string, today: string): DueReport {
  const todayAt = parseBoundary(today, 'start')
  if (todayAt === undefined) {
    throw new Error(`memory archive: ${JSON.stringify(today)} is not a valid archive date`)
  }

  const entries: DueEntry[] = []
  const malformed: DueMalformed[] = []
  let quiet = 0

  for (const hit of splitEntriesWithLines(text)) {
    const { line, entry } = hit
    if (!entry.tags.includes('限时')) continue

    const raw = entry.fields['起始']
    if (raw === undefined) {
      malformed.push({ line, raw: firstLine(entry.text), reason: '限时记忆没有写 `起始: YYYY-MM-DD`' })
      continue
    }

    const startAt = parseBoundary(raw, 'start')
    if (startAt === undefined) {
      malformed.push({ line, raw: firstLine(entry.text), reason: `起始 ${JSON.stringify(raw)} 不是合法的 YYYY-MM-DD` })
      continue
    }

    const age = dayNumber(todayAt) - dayNumber(startAt)
    if (age < 0) {
      malformed.push({ line, raw: firstLine(entry.text), reason: `起始 ${raw} 在未来，比今天还晚 ${-age} 天` })
      continue
    }

    const level = levelOf(age)
    if (level === 'quiet') {
      quiet += 1
      continue
    }
    entries.push({ line, start: raw, age, level, tags: entry.tags, text: firstLine(entry.text) })
  }

  return { today, entries, quiet, malformed }
}

/**
 * @param at - 一个时刻。
 * @returns 档案时区下这是第几天（整数）。
 */
function dayNumber(at: Date): number {
  return Math.floor((at.getTime() + ARCHIVE_OFFSET_MINUTES * 60_000) / 86_400_000)
}

/**
 * @param age - 日历天数。
 * @returns 落在哪一档。
 */
function levelOf(age: number): DueLevel {
  let level: DueLevel = 'quiet'
  for (const step of DUE_LEVELS) {
    if (age >= step.at) level = step.level
  }
  return level
}

/**
 * @param text - 条目正文。
 * @returns 那一行，供认一眼认出。
 */
function firstLine(text: string): string {
  return text.split('\n')[0] ?? ''
}
