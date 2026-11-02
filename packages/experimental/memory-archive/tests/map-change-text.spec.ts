import { describe, expect, it } from 'vitest'
import { renderMapChanges } from '../src/map-change-text.ts'

describe('renderMapChanges', () => {
  it('没有变化 -> 空字符串', () => {
    expect(renderMapChanges([])).toBe('')
  })

  it('字段变化 -> 一行 ~', () => {
    expect(renderMapChanges([{ kind: 'changed', section: 'archive', field: 'level', before: 'soft', after: 'gated' }]))
      .toBe('~ archive · level: soft -> gated')
  })

  it('增删 -> 一行 + / 一行 -', () => {
    expect(renderMapChanges([
      { kind: 'added', section: 'temp' },
      { kind: 'removed', section: 'todo' },
    ])).toBe('+ temp\n- todo')
  })

  it('顺序变化 -> 一行 ~ order', () => {
    expect(renderMapChanges([{ kind: 'reordered', before: ['a', 'b'], after: ['b', 'a'] }]))
      .toBe('~ order: a, b -> b, a')
  })
})
