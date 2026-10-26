import { describe, expect, it } from 'vitest'
import { parse } from '../src/archive-time.ts'
import { appendEntry, parseEntryLine, renderEntry, splitEntries } from '../src/archive-entry.ts'
import type { Entry } from '../src/archive-entry.ts'

const AT = parse('2026-10-26 14:42:51') as Date

describe('parseEntryLine', () => {
  it('splits one line into time, tags, fields and text', () => {
    expect(parseEntryLine('2026-10-26 14:42:51 [⭐, 档案插件, 设备: 台式机] · 拆骨架'))
      .toEqual({ at: AT, tags: ['⭐', '档案插件'], fields: { 设备: '台式机' }, text: '拆骨架' })
  })

  it('accepts an empty metadata slot', () => {
    expect(parseEntryLine('2026-10-26 14:42:51 [] · 无标签')?.tags).toEqual([])
  })

  it('ignores headings and blank lines', () => {
    expect(parseEntryLine('# 2026-10-26 周一')).toBeUndefined()
    expect(parseEntryLine('')).toBeUndefined()
  })

  it('rejects an impossible time', () => {
    expect(parseEntryLine('2026-02-31 10:00:00 [x] · 不存在')).toBeUndefined()
  })
})

describe('renderEntry', () => {
  it('writes the three parts on one line', () => {
    expect(renderEntry({ at: AT, tags: ['⭐', '档案插件'], fields: { 设备: '台式机' }, text: '拆骨架' }))
      .toBe('2026-10-26 14:42:51 [⭐, 档案插件, 设备: 台式机] · 拆骨架' )
  })

  it('writes an empty slot when there is no metadata', () => {
    expect(renderEntry({ at: AT, tags: [], fields: {}, text: '无标签' }))
      .toBe('2026-10-26 14:42:51 [] · 无标签')
  })

  it('keeps multi-line text below the first line', () => {
    expect(renderEntry({ at: AT, tags: [], fields: {}, text: '第一行\n\n续写' }))
      .toBe('2026-10-26 14:42:51 [] · 第一行\n\n续写')
  })

  it('refuses an empty body', () => {
    expect(() => renderEntry({ at: AT, tags: [], fields: {}, text: '    ' })).toThrow(/must not be empty/u)
  })

  it('refuses a timestamp that would split the entry in two', () => {
    expect(() => renderEntry({ at: AT, tags: [], fields: {}, text: '2026-10-26 15:00:00 [x] · 假' }))
      .toThrow(/timestamp/u)
  })

  it('refuses a heading that would forge the page title', () => {
    expect(() => renderEntry({ at: AT, tags: [], fields: {}, text: '# 假标题' })).toThrow(/heading/u)
  })

  it('refuses metadata that would break the slot', () => {
    expect(() => renderEntry({ at: AT, tags: ['a]b'], fields: {}, text: 'x' })).toThrow(/brackets/u)
  })
})

describe('round trip', () => {
  it('survives render then split', () => {
    const entry: Entry = {
      at: AT, tags: ['⭐', '档案插件'], fields: { 设备: '台式机' }, text: '第一行\n\n续写',
    }
    expect(splitEntries(renderEntry(entry))).toEqual([entry])
  })
})

describe('appendEntry', () => {
  it('starts a blank file with one entry', () => {
    expect(appendEntry('', { at: AT, tags: [], fields: {}, text: '起点' }))
      .toBe('2026-10-26 14:42:51 [] · 起点\n')
  })

  it('keeps one blank line before the new entry', () => {
    expect(appendEntry('# 2026-10-26 周一\n', { at: AT, tags: [], fields: {}, text: '第二条' }))
      .toBe('# 2026-10-26 周一\n\n2026-10-26 14:42:51 [] · 第二条\n')
  })

  it('keeps the order of entries', () => {
    const first = appendEntry('', { at: AT, tags: [], fields: {}, text: '一' })
    const second = appendEntry(first, { at: AT, tags: [], fields: {}, text: '二' })
    expect(splitEntries(second).map(entry => entry.text)).toEqual(['一', '二'])
  })
})
