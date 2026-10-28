/** Clock readings: the archive's own zone, plus the machine's when they disagree. */

/** The zone whose calendar the archive is written in. */
export const ARCHIVE_TIME_ZONE = 'Asia/Shanghai'

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
  if (kind === 'weekday') {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: zone, weekday: 'short' }).format(now)
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
  const weekday = read(ARCHIVE_TIME_ZONE, now, 'weekday')
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
