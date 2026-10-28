import { describe, expect, it } from 'vitest'
import { daySeed, dayTitle, ensureDay } from '../src/archive-day.ts'
import type { ClockReading } from '../src/archive-clock.ts'

const SAME: ClockReading = { date: '2026-10-22', time: '14:38:00', weekday: '周四' }
const OFF: ClockReading = { date: '2026-10-22', time: '14:38:00', weekday: '周四', machineReading: '2026-10-21 23:38:00' }

describe('dayTitle', () => {
  it('names the date and weekday in one line', () => {
    expect(dayTitle(SAME)).toBe('# 2026-10-22 · 周四')
  })

  it('adds the machine reading only when the zones disagree', () => {
    expect(dayTitle(OFF)).toBe('# 2026-10-22 · 周四（本机 2026-10-21 23:38:00）')
  })

  it('leaves no trailing whitespace', () => {
    for (const line of daySeed(OFF).split('\n')) expect(line).toBe(line.trimEnd())
  })
})

describe('daySeed', () => {
  it('opens with the title line and nothing else', () => {
    expect(daySeed(SAME)).toBe('# 2026-10-22 · 周四\n')
  })
})

describe('ensureDay', () => {
  it('seeds a whole page when the file is blank', () => {
    expect(ensureDay('', SAME)).toBe(daySeed(SAME))
  })

  it('keeps a page that already has a title', () => {
    expect(ensureDay('# 2026-10-22 · 周四\n', SAME)).toBe('# 2026-10-22 · 周四\n')
  })

  it('adds the missing title above existing content', () => {
    expect(ensureDay('2026-10-22 09:00:00 [] · 起点\n', SAME))
      .toBe('# 2026-10-22 · 周四\n\n2026-10-22 09:00:00 [] · 起点\n')
  })
})
