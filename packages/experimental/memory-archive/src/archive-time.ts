/** 档案时间本体: 读表 / 解析 / 算间隔。全仓库只有这里可以 new Date()。 */

import { readClock } from './archive-clock.ts'
import type { ClockReading } from './archive-clock.ts'

/** 中国自 1991 年起不再用夏令时，Asia/Shanghai 固定 +08:00。 */
const ARCHIVE_OFFSET_MINUTES = 8 * 60

/** 一次读数: 原始时刻 + 已格式化的读法。 */
export interface Instant {
  readonly at: Date
  readonly reading: ClockReading
}

/** 现在。全仓库唯一调用 `new Date()` 的地方。 */
export function now(): Instant {
  const at = new Date()
  return { at, reading: readClock(at) }
}

const FULL = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u
const TIME = /^(\d{2}):(\d{2}):(\d{2})$/u

/**
 * @param text - [2026-10-25 19:29:29] 或 [19:29:29] 。
 * @param dateHint - 第二种写法必须给日期。
 * @returns 该时刻；写法不合法或日期不存在 (如 2 月 31 日) 时返回 undefined。
 */
export function parse(text: string, dateHint?: string): Date | undefined {
  const trimmed = text.trim()
  const full = FULL.exec(trimmed)
  const date = full === null ? dateHint?.trim() : `${full[1]}-${full[2]}-${full[3]}`
  const time = full === null ? trimmed : `${full[4]}:${full[5]}:${full[6]}`
  if (date === undefined || !/^\d{4}-\d{2}-\d{2}$/u.test(date) || !TIME.test(time)) return undefined

  const [y, mo, d] = date.split('-').map(Number) as [number, number, number]
  const [h, mi, s] = time.split(':').map(Number) as [number, number, number]

  // 先在 UTC 上构造，再检查有没有被 Date 悄悄进位 (2 月 31 日会变成 3 月 3 日) 。
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi, s))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() + 1 !== mo || probe.getUTCDate() !== d
        || probe.getUTCHours() !== h || probe.getUTCMinutes() !== mi || probe.getUTCSeconds() !== s) {
    return undefined
  }
  return new Date(probe.getTime() - ARCHIVE_OFFSET_MINUTES * 60_000)
}

/**
 * @param from - 起点时刻。
 * @param to - 终点时刻。
 * @returns 人话间隔，如 [2 小时 46 分] 。
 */
export function between(from: Date, to: Date): string {
  const ms = Math.abs(to.getTime() - from.getTime())
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return `${Math.floor(ms / 1000)} 秒`
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`
  const days = Math.floor(hours / 24)
  const left = hours % 24
  return left === 0 ? `${days} 天` : `${days} 天 ${left} 小时`
}

/**
 * @param at - 一个时刻。
 * @returns 档案时区下的 `YYYY-MM-DD HH:MM:SS`，与 `parse` 互逆。
 */
export function format(at: Date): string {
  const reading = readClock(at)
  return `${reading.date} ${reading.time}`
}

/** 时间区间的端点。 */
export type TimeEdge = 'start' | 'end'

/** 只给了日期、没给时刻的写法。 */
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/u

/**
 * @param text - `YYYY-MM-DD`、`YYYY-MM-DD HH:MM:SS`，或配 dateHint 的 `HH:MM:SS`。
 * @param edge - 只给日期时，补成当天开头还是当天结尾。
 * @param dateHint - 裸时间必须给日期。
 * @returns 该时刻；写法不合法或日期不存在时返回 undefined。
 */
export function parseBoundary(text: string, edge: TimeEdge, dateHint?: string): Date | undefined {
  const trimmed = text.trim()
  if (DAY_ONLY.test(trimmed)) return parse(`${trimmed} ${edge === 'start' ? '00:00:00' : '23:59:59'}`)
  return parse(trimmed, dateHint)
}
