import { describe, expect, it } from 'vitest'
import { daySeed, dayTitle, ensureDay } from '../src/archive-day.ts'
import type { ClockReading } from '../src/archive-clock.ts'

const SAME: ClockReading = { date: '2026-10-22', time: '14:38', weekday: '周四' }
const OFF: ClockReading = { date: '2026-10-22', time: '14:38', weekday: '周四', machine: '2026-10-21 23:38' }

describe('dayTitle', () => {
  it('names the date and weekday in one line', () => {
    expect(dayTitle(SAME)).toBe('# 2026-10-22 · 周四')
  })

  it('adds the machine reading only when the zones disagree', () => {
    expect(dayTitle(OFF)).toBe('# 2026-10-22 · 周四 (本机 2026-10-21 23:38) ')
  })
})

describe('daySeed', () => {
  it('opens with the title, the time block and the event block, in that order', () => {
    expect(daySeed(SAME)).toBe('# 2026-10-22 · 周四\n\n## 时间\n\n## 事件\n')
  })

  it('leaves no trailing whitespace', () => {
    for (const line of daySeed(SAME).split('\n')) expect(line).toBe(line.trimEnd())
  })
})

describe('ensureDay', () => {
  it('seeds a whole page when the file is blank', () => {
    expect(ensureDay('', SAME)).toBe(daySeed(SAME))
  })

  it('keeps a page that already has a title', () => {
    expect(ensureDay('# 2026-10-22 · 周四\n\n## 事件\n', SAME)).toBe('# 2026-10-22 · 周四\n\n## 事件\n')
  })

  it('adds the missing title above existing content', () => {
    expect(ensureDay('## 事件\n\n### 09:00 · 起点\n', SAME)).toBe('# 2026-10-22 · 周四\n\n## 事件\n\n### 09:00 · 起点\n')
  })
})
