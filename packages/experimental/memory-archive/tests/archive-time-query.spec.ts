import { describe, expect, it } from 'vitest'
import { answerTime } from '../src/archive-time-query.ts'
import { renderTime } from '../src/time-output.ts'

// 2026-10-30T13:09:20Z = 北京 2026-10-30 21:09:20 (周五)
const NOW = new Date('2026-10-30T13:09:20Z')

describe('answerTime', () => {
  it('reports the archive clock when nothing else is asked', () => {
    expect(answerTime({}, NOW)).toEqual({ date: '2026-10-30', time: '21:09:20', weekday: '周五' })
  })

  it('measure from a past moment to now and echoes what it was given', () => {
    expect(answerTime({ since: '2026-10-30 04:00:00' }, NOW)).toEqual({
      date: '2026-10-30', time: '21:09:20', weekday: '周五',
      since: '2026-10-30 04:00:00', elapsed: '17 小时 9 分',
    })
  })

  it('measure between two given moments', () => {
    expect(answerTime({ from: '2026-10-30 10:15:00', to: '2026-10-30 22:02:00' }, NOW).span)
      .toBe('11 小时 47 分')
  })

  it('refuses a half-given span', () => {
    expect(() => answerTime({ from: '2026-10-30 10:15:00' }, NOW))
      .toThrow(/`from` and `to` must be given together/u)
  })

  it('names the field it could not parse', () => {
    expect(() => answerTime({ since: '昨天' }, NOW)).toThrow(/`since` is not a valid timestamp/u)
  })
})

describe('renderTime', () => {
  const BASE = { date: '2026-10-30', time: '21:09:20', weekday: '周五' }

  it('prints the clock line and one line per interval', () => {
    expect(renderTime({ ...BASE, since: '2026-10-30 04:00:00', elapsed: '17 小时 9 分' }))
      .toBe('现在: 2026-10-30 21:09:20 (周五)\n从 2026-10-30 04:00:00 到现在：已过 17 小时 9 分')
  })

  it('mentions the machine clock only when it disagrees', () => {
    expect(renderTime(BASE)).not.toContain('本机')
    expect(renderTime({ ...BASE, machineReading: '13:09:20' })).toContain('13:09:20')
  })
})
