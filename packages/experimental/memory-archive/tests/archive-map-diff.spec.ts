import { describe, expect, it } from 'vitest'
import { diffIndex, MAP_SCOPE } from '../src/archive-map-diff.ts'
import { ArchiveIndex, ArchiveSection } from '../src/archive-index.ts'

const section = (name: string, over: Partial<ArchiveSection> = {}): ArchiveSection =>
  ({ name, path: `${name}.md`, kind: 'append', layout: 'daily', level: 'soft', warning: 'none', ...over })

const index = (...sections: ArchiveSection[]): ArchiveIndex => ({ version: 2, sections })


describe('diffIndex', () => {
  it('两份完全相同 -> 没有变化', () => {
    expect(diffIndex(index(section('a')), index(section('a')))).toEqual([])
  })

  it('改 level -> 一条 changed', () => {
    expect(diffIndex(index(section('a', { level: 'soft' })), index(section('a', { level: 'gated' }))))
      .toEqual([{ kind: 'changed', section: 'a', field: 'level', before: 'soft', after: 'gated' }])
  })

  it('加一个区块 -> 一条 added，没有假的 reordered', () => {
    expect(diffIndex(index(section('a'), section('b')), index(section('a'), section('b'), section('c'))))
      .toEqual([{ kind: 'added', section: 'c' }])
  })

  it('删一个区块 -> 一条 removed，没有假的 reordered', () => {
    expect(diffIndex(index(section('a'), section('b')), index(section('a'))))
      .toEqual([{ kind: 'removed', section: 'b' }])
  })

  it('改 path -> 一条 changed', () => {
    expect(diffIndex(index(section('a', { path: 'x.md' })), index(section('a', { path: 'y.md' }))))
      .toEqual([{ kind: 'changed', section: 'a', field: 'path', before: 'x.md', after: 'y.md' }])
  })

  it('同一区块改两个字段 -> 两条，按固定字段顺序', () => {
    expect(diffIndex(
      index(section('a', { path: 'x.md', level: 'soft' })),
      index(section('a', { path: 'y.md', level: 'gated' })),
    )).toEqual([
      { kind: 'changed', section: 'a', field: 'path', before: 'x.md', after: 'y.md' },
      { kind: 'changed', section: 'a', field: 'level', before: 'soft', after: 'gated' },
    ])
  })

  it('layout 从无到有 -> before 是 —', () => {
    const withoutLayout: ArchiveSection = {
      name: 'a', path: 'a.md', kind: 'append', level: 'soft', warning: 'none',
    }
    expect(diffIndex(
      index(withoutLayout),
      index(section('a', { layout: 'single' })),
    )).toEqual([{ kind: 'changed', section: 'a', field: 'layout', before: '—', after: 'single' }])
  })

  it('只换顺序 -> 一条 reordered', () => {
    expect(diffIndex(index(section('a'), section('b')), index(section('b'), section('a'))))
      .toEqual([{ kind: 'reordered', before: ['a', 'b'], after: ['b', 'a'] }])
  })

  it('改 trail -> 一条 changed，作用域是 (map)', () => {
    expect(diffIndex(index(section('a')), { ...index(section('a')), trail: 'daily' }))
      .toEqual([{ kind: 'changed', section: MAP_SCOPE, field: 'trail', before: '—', after: 'daily' }])
  })

  it('两个区块各改一处 -> 按旧地图的顺序', () => {
    expect(diffIndex(
      index(section('a', { level: 'soft' }), section('b', { level: 'soft' })),
      index(section('a', { level: 'gated' }), section('b', { level: 'free' })),
    )).toEqual([
      { kind: 'changed', section: 'a', field: 'level', before: 'soft', after: 'gated' },
      { kind: 'changed', section: 'b', field: 'level', before: 'soft', after: 'free' },
    ])
  })
})
