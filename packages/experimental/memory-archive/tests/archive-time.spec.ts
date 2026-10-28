import { between, format, now, parse, parseBoundary } from '../src/archive-time.ts'
import { describe, expect, it } from 'vitest'

describe('parse', () => {
  it('reads a full archive stamp as Asia/Shanghai wall time', () => {
    // 19:29:29 北京 = 11:29:29 UTC
    expect(parse('2026-10-25 19:29:29')?.toISOString()).toBe('2026-10-25T11:29:29.000Z')
  })

  it('accepts a bare time when the date is supplied', () => {
    expect(parse('19:29:29', '2026-10-25')?.toISOString()).toBe('2026-10-25T11:29:29.000Z')
  })

  it('rejects a date that does not exist', () => {
    expect(parse('2026-02-31 10:00:00')).toBeUndefined()
  })

  it('rejects a bare time with no date hint', () => {
    expect(parse('19:29:29')).toBeUndefined()
  })

  it('rejects junk', () => {
    expect(parse('昨天下午')).toBeUndefined()
  })
})

describe('between', () => {
  it('reports seconds below one minuts', () => {
    expect(between(new Date('2026-10-25T10:00:00Z'), new Date('2026-10-25T10:00:04Z'))).toBe('4 秒')
  })

  it('reports hours and minutes', () => {
    expect(between(new Date('2026-10-25T10:00:00Z'), new Date('2026-10-25T12:46:00Z'))).toBe('2 小时 46 分')
  })

  it('reports whole days without a trailing zero', () => {
    expect(between(new Date('2026-10-25T10:00:00Z'), new Date('2026-10-27T10:00:00Z'))).toBe('2 天')
  })

  it('ignores direction', () => {
    expect(between(new Date('2026-10-25T12:46:00Z'), new Date('2026-10-25T10:00:00Z'))).toBe('2 小时 46 分')
  })
})

describe('now', () => {
  it('returns the current instant', () => {
    const at = now()
    expect(at).toBeInstanceOf(Date)
    expect(Math.abs(at.getTime() - Date.now())).toBeLessThan(1000)
  })
})

describe('format', () => {
  it('writes the archive stamp that parse reads back', () => {
    const at = parse('2026-10-25 19:29:29') as Date
    expect(format(at)).toBe('2026-10-25 19:29:29')
  })

  it('reads UTC as Beijing wall time', () => {
    expect(format(new Date('2026-10-25T11:29:29Z'))).toBe('2026-10-25 19:29:29')
  })
})

describe('parsseBoundary', () => {
  it('opens a bare day at midnight', () => {
    expect(parseBoundary('2026-10-26', 'start')?.toISOString()).toBe('2026-10-25T16:00:00.000Z')
  })

  it('closes a bare day at its last secound', () => {
    expect(parseBoundary('2026-10-26', 'end')?.toISOString()).toBe('2026-10-26T15:59:59.000Z')
  })

  it('leaves an explicit time alone', () => {
    expect(parseBoundary('2026-10-26 10:00:00', 'end')?.toISOString()).toBe('2026-10-26T02:00:00.000Z')
  })

  it('rejects a day that does not exist', () => {
    expect(parseBoundary('2026-02-31', 'start')).toBeUndefined()
  })
})
