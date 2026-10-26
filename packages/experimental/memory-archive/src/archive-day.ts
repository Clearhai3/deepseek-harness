/** The daily page: its title line, its opening seed, and keeping that opening in place. */

import type { ClockReading } from './archive-clock.ts'

/**
 * @param clock - reading for that day.
 * @returns the `#` title line, naming the machine reading when the zones disagree.
 */
export function dayTitle(clock: ClockReading): string {
  const machine = clock.machine === undefined ? '' : `（本机 ${clock.machine}）`
  return `# ${clock.date} · ${clock.weekday}${machine}`
}

/**
 * @param clock - reading for that day.
 * @returns the opening a daily page starts with: the title line and nothing else.
 */
export function daySeed(clock: ClockReading): string {
  return `${dayTitle(clock)}\n`
}

/**
 * @param text - current page content, possibly empty.
 * @param clock - reading for that day.
 * @returns the text with a title line, seeding the whole page when it is blank.
 */
export function ensureDay(text: string, clock: ClockReading): string {
  if (text.trim().length === 0) return daySeed(clock)
  if (text.startsWith('# ')) return text
  return `${dayTitle(clock)}\n\n${text.replace(/^\s+/u, '')}`
}
