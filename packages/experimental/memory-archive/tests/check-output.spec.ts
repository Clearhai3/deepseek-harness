import { describe, expect, it } from 'vitest'
import { parse } from '../src/archive-time.ts'
import { SUMMARY_CHARS, renderCheck, summarize } from '../src/check-output.ts'

const AT = parse('2026-10-26 18:48:25') as Date

describe('summarize', () => {
  it('keeps a short body whole', () => {
    expect(summarize('拆骨架')).toBe('拆骨架')
  })

  it('takes only the first line', () => {
    expect(summarize('第一行\n第二行')).toBe('第一行')
  })

  it('cuts a long body at the character limit', () => {
    const body = '一'.repeat(SUMMARY_CHARS + 10)
    expect(summarize(body)).toBe(`${'一'.repeat(SUMMARY_CHARS)}…`)
  })

  it('counts code points, so an emoji is never cut in half', () => {
    const body = '🐋'.repeat(SUMMARY_CHARS + 1)
    expect(summarize(body)).toBe(`${'🐋'.repeat(SUMMARY_CHARS)}…`)
  })
})

describe('renderCheck', () => {
  it('says so when nothing matched', () => {
    expect(renderCheck([])).toBe('No entries matched.')
  })

  it('puts path, line, time, metadata and summary on one line', () => {
    expect(renderCheck([{
      path: 'journal/2026-10/2026-10-26.md',
      line: 3,
      entry: { at: AT, tags: ['⭐', '档案插件'], fields: { 设备: '台式机' }, text: '拆骨架完成：一条记录压成一行' },
    }])).toBe(
      'journal/2026-10/2026-10-26.md:3  2026-10-26 18:48:25  [⭐, 档案插件, 设备: 台式机]  拆骨架完成：一条记录压成一行',
    )
  })
})
