/** 时间工具的回答：只算，不读文件。 */

import { readClock } from './archive-clock.ts'
import { between, parse } from './archive-time.ts'

export interface TimeQuery {
  readonly since?: string
  readonly from?: string
  readonly to?: string
}

export interface TimeAnswer {
  readonly date: string
  readonly time: string
  readonly weekday: string
  readonly machineReading?: string
  readonly elapsed?: string
  readonly since?: string
  readonly span?: string
}

/**
 * @param text - 调用方给的时间点。
 * @param field - 出错时报错哪个字段。
 * @returns 解析出的时刻。
 * @throws 写法不合法时 —— 报错要能直接改。
 */
function moment(text: string, field: string): Date {
  const at = parse(text)
  if (at === undefined) {
    throw new Error(`memory archive: \`${field}\` is not a valid timestamp; use \`YYYY-MM-DD HH:MM:SS\` (got ${JSON.stringify(text)})`)
  }
  return at
}

/**
 * @param query - What the caller wants to know.
 * @param at - the current moment, injected so tests can pin it.
 * @returns the clock reading plus the intervals asked for.
 * @throws 时间写法非法，或 from / to 只给了一个。
 */
export function answerTime(query: TimeQuery, at: Date): TimeAnswer {
  if ((query.from === undefined) !== (query.to === undefined)) {
    throw new Error('memory archive: `from` and `to` must be given together')
  }
  const clock = readClock(at)
  const base = { date: clock.date, time: clock.time, weekday: clock.weekday,
    ...(clock.machineReading === undefined ? {} : { machineReading: clock.machineReading }) }
  const elapsed = query.since === undefined ? undefined : between(moment(query.since, 'since'), at)
  const span = query.from === undefined || query.to === undefined
    ? undefined
    : between(moment(query.from, 'from'), moment(query.to, 'to'))
  const since = query.since
  return { ...base,
    ...(since === undefined ? {} : { since }),
    ...(elapsed === undefined ? {} : { elapsed }),
    ...(span === undefined ? {} : { span }) }
}
