import { describe, expect, it } from 'vitest'
import { readClock } from '../src/archive-clock.ts'

describe('readClock', () => {
  it('reads the Beijing calendar, not the machine calendar', () => {
    //2026-10-21 17:00 UTC = 2026-10-22 01:00 北京
    expect(readClock(new Date('2026-10-21T17:00:00Z')).date).toBe('2026-10-22')
  })

  it('reports the weekday in Chinese', () => {
    expect(readClock(new Date('2026-10-22T04:00:00Z')).weekday).toBe('周四')
  })

  it('keeps midnight at 00:00:00', () => {
    expect(readClock(new Date('2026-10-21T16:00:00Z')).time).toBe('00:00:00')
  })

  it('adds the machine reading only when it disagrees', () => {
    const same = readClock(new Date('2026-10-22T04:00:00Z'))
    expect(same.machine).toBeUndefined()
    expect(same.time).toBe('12:00:00')
  })

  it('keeps the seconds', () => {
    expect(readClock(new Date('2026-10-22T04:00:59Z')).time).toBe('12:00:59')
  })
})
