import { describe, expect, it } from 'vitest'
import { dueEntries } from '../src/archive-due'

/** 造一条限时记忆。`起始` 由参数决定，其余照真实格式。 */
function entry(start: string, body = '某条记忆'): string {
  return `2026-10-28 19:50:00 [限时，起始: ${start}, 档案插件] · ${body}\n`
}

describe('dueEntries', () => {
  const today = '2026-10-31'

  it('正好 3 天 -> small', () => {
    const [first] = dueEntries(entry('2026-10-28'), today).entries
    expect(first?.age).toBe(3)
    expect(first?.level).toBe('small')
  })

  it('2 天 -> 只记 quiet, 不选 entries', () => {
    const report = dueEntries(entry('2026-10-29'), today)
    expect(report.entries).toHaveLength(0)
    expect(report.quiet).toBe(1)
  })

  it.each([
    ['2026-10-22', 9, 'big'],
    ['2026-10-16', 15, 'urgent'],
    ['2026-10-01', 30, 'expire'],
  ])('起始 %s -> %i 天 %s', (start, age, level) => {
    const [first] = dueEntries(entry(start), today).entries
    expect(first?.age).toBe(age)
    expect(first?.level).toBe(level)
  })

  it('缺 `起始` 字段 -> malformed，不许静默丢', () => {
    const text = '2026-10-28 19:50:00 [限时，档案插件] · 忘了写起始\n'
    const report = dueEntries(text, today)
    expect(report.entries).toHaveLength(0)
    expect(report.malformed).toHaveLength(1)
    expect(report.malformed[0]?.reason).toContain('起始')
  })

  it('起始在未来 -> malformed', () => {
    const report = dueEntries(entry('2027-01-01'), today)
    expect(report.entries).toHaveLength(0)
    expect(report.malformed).toHaveLength(1)
    expect(report.malformed[0]?.reason).toContain('未来')
  })

  it('没有 `限时` 标签 -> 完全无视', () => {
    const text = '2026-10-01 10:00:00 [上线, 档案插件] · 普通日志\n'
    const report = dueEntries(text, today)
    expect(report.entries).toHaveLength(0)
    expect(report.quiet).toBe(0)
    expect(report.malformed).toHaveLength(0)
  })
})
