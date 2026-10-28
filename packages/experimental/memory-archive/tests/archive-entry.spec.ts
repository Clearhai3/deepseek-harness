import { describe, expect, it } from 'vitest'
import { parse } from '../src/archive-time.ts'
import { appendEntry, findEntries, parseEntryLine, renderEntry, splitEntries } from '../src/archive-entry.ts'
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

  it('reads full-width separators the same way', () => {
    expect(parseEntryLine('2026-10-26 14:42:51 [⭐，档案插件，设备：台式机] · 拆骨架'))
      .toEqual({ at: AT, tags: ['⭐', '档案插件'], fields: { 设备: '台式机' }, text: '拆骨架' })
  })

  it('reads full-width brackets and a full-width middle dot', () => {
    expect(parseEntryLine('2026-10-26 14:42:51 ［⭐］・ 拆骨架')?.tags).toEqual(['⭐'])
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

  it('round-trips a hand-edited line into half-width form', () => {
    const line = '2026-10-26 14:42:51 [⭐，档案插件，设备：台式机] · 拆骨架'
    expect(renderEntry(parseEntryLine(line) as Entry))
      .toBe('2026-10-26 14:42:51 [⭐, 档案插件, 设备: 台式机] · 拆骨架')
  })

  it('still accepts ordinary fields and rejects a full-width colon inside a tag', () => {
    expect(renderEntry({ at: AT, tags: [], fields: { 设备: '台式机' }, text: 'x' }))
      .toBe('2026-10-26 14:42:51 [设备: 台式机] · x')
    expect(() => renderEntry({ at: AT, tags: ['a：b'], fields: {}, text: 'x' })).toThrow()
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

describe('findEntries', () => {
  const DOC = [
    '# 2026-10-26 · 周一',
    '',
    '2026-10-26 08:00:00 [上线] · 起来了',
    '2026-10-26 12:00:00 [⭐, 设计] · 定案',
    '',
    '续写属于上一条',
    '2026-10-26 20:00:00 [下线] · 收工',
  ].join('\n')

  it('reports 1-based line numbers', () => {
    expect(findEntries(DOC, {}).map(hit => hit.line)).toEqual([3, 4, 7])
  })

  it('keeps continuation lines inside their record', () => {
    expect(findEntries(DOC, { tags: ['设计'] })[0]?.entry.text).toBe('定案\n\n续写属于上一条')
  })

  it('filters by an inclusive time range', () => {
    const from = parse('2026-10-26 12:00:00') as Date
    const to = parse('2026-10-26 20:00:00') as Date
    expect(findEntries(DOC, { from, to }).map(hit => hit.line)).toEqual([4, 7])
  })

  it('requires every tag to match', () => {
    expect(findEntries(DOC, { tags: ['⭐'] }).map(hit => hit.line)).toEqual([4])
    expect(findEntries(DOC, { tags: ['⭐', '设计'] }).map(hit => hit.line)).toEqual([4])
    expect(findEntries(DOC, { tags: ['⭐', '上线'] })).toEqual([])
  })

  it('never matches on body text', () => {
    expect(findEntries(DOC, { tags: ['续写'] })).toEqual([])
  })
})
