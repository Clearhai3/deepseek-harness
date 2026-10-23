import { describe, expect, it } from 'vitest'
import { appendToBlock, appendToList, findBlock } from '../src/archive-structure.ts'

const DOC = `# 2026-10-22 · 周四

## 时间
- 10:21 上线

## 事件

### 10:24 · 第一件

## 明天要做
- 买牛奶
`

describe('findBlock', () => {
  it('locates a block and ends it at the next heading', () => {
    expect(findBlock(DOC, '事件')).toEqual({ title: '事件', start: 5, end: 9 })
  })

  it('ignores the deeper headings', () => {
    expect(findBlock(DOC, '### 10:24 · 第一件')).toBeUndefined()
  })

  it('returns undefined for a heading the document lacks', () => {
    expect(findBlock(DOC, '不存在')).toBeUndefined()
  })
})

describe('appendToList', () => {
  it('adds a stanza at the end of the block, before the next heading', () => {
    const next = appendToBlock(DOC, '事件', '### 19:58 · 第二件\n\n正文')
    expect(next).toContain('### 10:24 · 第一件\n\n### 19:58 · 第二件\n\n正文\n\n## 明天要做')
  })

  it('creates the block when the document lacks it', () => {
    const next = appendToBlock('# 2026-10-22 · 周四\n', '事件', '### 09:00 · 起点')
    expect(next).toBe('# 2026-10-22 · 周四\n\n## 事件\n\n### 09:00 · 起点\n')
  })
})

describe('appendToList', () => {
  it('puts the item right under the list, with no blank line', () => {
    const next = appendToList(DOC, '时间', '- 19:58 下线')
    expect(next).toContain('- 10:21 上线\n- 19:58 下线\n\n## 事件')
  })
})
