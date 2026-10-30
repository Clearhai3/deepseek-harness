/** Clock readings: the archive's own zone, plus the machine's when they disagree. */

/** The zone whose calendar the archive is written in. */
export const ARCHIVE_TIME_ZONE = 'Asia/Shanghai'

/** 中国自 1991 年起不再用夏令时，Asia/Shanghai 固定 +08:00。 */
export const ARCHIVE_OFFSET_MINUTES = 8 * 60

/** 星期名；不用 `Intl` —— 档案格式不能依赖平台 ICU。 */
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/**
 * @param at - 一个时刻。
 * @returns 档案时区下的星期名，如 `周四`。
 */
export function weekdayName(at: Date): string {
  const shifted = new Date(at.getTime() + ARCHIVE_OFFSET_MINUTES * 60_000)
  return WEEKDAYS[shifted.getUTCDay()] as string
}

/** One clock reading. */
export interface ClockReading {
  /** Calendar date in the archive's zone, `YYYY-MM-DD`. */
  readonly date: string
  /** `HH:MM:SS` in the archive's zone. */
  readonly time: string
  /** Weekday in the archive's zone, e.g. `周四`. */
  readonly weekday: string
  /** The machine's own reading, present only when it differs from the archive's. */
  readonly machineReading?: string
}

/**
 * @param zone - IANA zone name; omit for the machine's zone.
 * @param now - clock reading.
 * @param kind - which field to format.
 * @returns one formatted field.
 */
function read(zone: string | undefined, now: Date, kind: 'date' | 'time' | 'weekday'): string {
  if (kind === 'date') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now)
  }
  // hourCycle h23 keeps midnight at 00:00; hour12:false can yield 24:00 in some ICU builds.
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(now)
}

/**
 * @param now - clock reading; injected so tests can pin it.
 * @returns the archive-zone reading, plus the machine's when the two disagree.
 */
export function readClock(now: Date): ClockReading {
  const date = read(ARCHIVE_TIME_ZONE, now, 'date')
  const time = read(ARCHIVE_TIME_ZONE, now, 'time')
  const weekday = weekdayName(now)
  const machineDate = read(undefined, now, 'date')
  const machineTime = read(undefined, now, 'time')
  if (machineDate === date && machineTime === time) return { date, time, weekday }
  return {
    date,
    time,
    weekday,
    machineReading: machineDate === date ? machineTime : `${machineDate} ${machineTime}`,
  }
}
